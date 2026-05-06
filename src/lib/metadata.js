// Metadata encoding/decoding functions for Discord messages

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const FOOTER_SIGNATURE = "Sent by a ZDS AI Agent • zds-agents.com";
const ACL_NO_RESPONSE_MESSAGE = "\n\nFor your information only.  Replies to this message will not be processed.";
const ACL_REACTIONS_ONLY_MESSAGE = "\n\nNote: You are at the ACL limit.  You may only respond with a REACTION (e.g., REACTION:eyes) to acknowledge this message.  Text responses will be blocked.";
const RESPONSE_TAG_GUIDANCE = "\n\nIMPORTANT: Wrap your Discord response text in <response> tags.  Only content inside <response>...</response> will be delivered to Discord.  Content outside these tags (thinking, reasoning, tool use) will be stripped.  Example: <response>Hello!</response>";

/**
 * Load server configuration
 * @param {string} guildId - Guild ID
 * @param {boolean} debug - Enable debug logging
 * @returns {Object|null} Server config or null
 */
function loadServerConfig(guildId, debug = false) {
  const zdsAiRoot = process.env.ZDS_AI_ROOT || '/usr/local/share/zds-ai';
  const configPath = join(zdsAiRoot, 'data', 'sociobot', 'servers', `${guildId}.json`);
  if (!existsSync(configPath)) {
    console.warn(`[sociobot] Server config missing: ${configPath} — ACL will use defaults. See data/sociobot/servers/README.md.`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.warn(`[sociobot] Failed to parse ${configPath}: ${error.message}`);
    return null;
  }
}

const DEFAULT_MAX_ACL = 2;
const BOT_DMS_MAX_ACL = 4;
const DM_MAX_ACL = 2;
export const OWNER_MAX_ACL = 999;
export const BOT_DMS_CHANNEL_ID = '1418032549430558782'; // TODO: move to per-server config

/**
 * Check if this agent owns the given channel (OWNED_CHANNELS env var, comma-separated IDs)
 * @param {string} channelId - Discord channel ID
 * @returns {boolean}
 */
export function isChannelOwner(channelId) {
  const owned = (process.env.OWNED_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);
  return owned.includes(channelId);
}

/**
 * Calculate maximum ACL based on number of ZDS bots in channel
 * Can be lowered by MAX_ACL environment variable for per-agent limits
 * @param {Object} channel - Discord channel object
 * @param {boolean} debug - Enable debug logging
 * @returns {number} Maximum ACL allowed
 */
export function getMaxACL(channel, debug = false, minACL = 1) {
  // Channel owners have no ACL restrictions on their owned channels
  if (isChannelOwner(channel.id)) {
    if (debug) console.log(`Agent owns channel ${channel.id}, ACL unrestricted (${OWNER_MAX_ACL})`);
    return OWNER_MAX_ACL;
  }

  // Not a guild channel (DMs or other non-guild channel)
  if (!channel.guild) {
    // bot-dms channel?  return 4 if so, otherwise default to 2
    if (channel.id === BOT_DMS_CHANNEL_ID) {
      if (debug) console.log(`In bot-dms channel, setting max ACL to 4`);
      return BOT_DMS_MAX_ACL;
    }
    return DM_MAX_ACL;
  }

  const serverConfig = loadServerConfig(channel.guild.id, debug);
  if (!serverConfig?.zdsAiAgentsRoleId) {
    return DEFAULT_MAX_ACL;
  }

  const zdsBotCount = channel.guild.members.cache.filter(member => {
    if (!member.user.bot) return false;
    if (!member.roles.cache.has(serverConfig.zdsAiAgentsRoleId)) return false;
    return channel.permissionsFor(member)?.has('ViewChannel');
  }).size;

  const calculatedMaxACL = Math.max(minACL, 5 - zdsBotCount);

  // Check for per-agent ACL limit (can only lower, not raise)
  if (process.env.MAX_ACL) {
    const agentMaxACL = parseInt(process.env.MAX_ACL);
    if (!isNaN(agentMaxACL) && agentMaxACL > 0) {
      return Math.min(calculatedMaxACL, agentMaxACL);
    }
  }

  return calculatedMaxACL;
}

/**
 * Extract ACL from Discord message embed footer
 * @param {Object} message - Discord message object
 * @returns {number} - ACL value or 0 if not found
 */
export function getACL(message) {
  if (message.author.bot && message.embeds.length > 0 && message.embeds[0].footer?.text) {
    const footerText = message.embeds[0].footer.text;
    const aclMatch = footerText.match(/acl:(\d+)/);
    if (aclMatch) {
      return parseInt(aclMatch[1]);
    }
  }
  return 0;
}

/**
 * Check if a specific bot has participated in the message thread
 * @param {Object} message - Discord message object to start from
 * @param {string} botUserId - Bot user ID to check for
 * @param {number} maxDepth - Maximum depth to search (default: 20)
 * @returns {Promise<boolean>} - True if bot participated in thread
 */
export async function hasParticipatedInThread(message, botUserId, maxDepth = 20) {
  let currentMessage = message;
  let depth = 0;

  // Walk up the reply chain looking for messages from this bot
  while (currentMessage.reference?.messageId && depth < maxDepth) {
    try {
      const referencedMessage = await currentMessage.channel.messages.fetch(currentMessage.reference.messageId);

      // Check if this message is from our bot
      if (referencedMessage.author.bot && referencedMessage.author.id === botUserId) {
        return true;
      }

      currentMessage = referencedMessage;
      depth++;
    } catch (error) {
      // Stop if we can't fetch the referenced message
      break;
    }
  }

  return false;
}

/**
 * Check if a specific bot authored the message or its immediate parent
 * @param {Object} message - Discord message object
 * @param {string} botUserId - Bot user ID to check for
 * @returns {Promise<boolean>} - True if bot authored message or parent
 */
export async function isMessageAuthor(message, botUserId) {
  // Check if this bot authored the message we're replying to
  if (message.reference?.messageId) {
    try {
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (referencedMessage.author.bot && referencedMessage.author.id === botUserId) {
        return true;
      }

      // Check the parent of the referenced message (grandparent)
      if (referencedMessage.reference?.messageId) {
        try {
          const parentMessage = await message.channel.messages.fetch(referencedMessage.reference.messageId);
          if (parentMessage.author.bot && parentMessage.author.id === botUserId) {
            return true;
          }
        } catch (error) {
          // Couldn't fetch grandparent, that's ok
        }
      }
    } catch (error) {
      // Couldn't fetch referenced message, that's ok
    }
  }

  return false;
}

/**
 * Check if a specific bot was mentioned in the message
 * @param {Object} message - Discord message object
 * @param {string} botUserId - Bot user ID to check for
 * @param {string} agentName - Agent name to check for (e.g., "aiden", "tess")
 * @returns {boolean} - True if bot was mentioned (via @tag or by name)
 */
export function wasMentionedInMessage(message, botUserId, agentName) {
  if (!agentName) {
    console.error('wasMentionedInMessage: agentName is required');
    process.exit(1);
  }

  // Check for @mention (direct user mention)
  if (message.mentions?.users?.has(botUserId)) {
    return true;
  }

  // Check for name mention in message content (case-insensitive)
  const content = message.content.toLowerCase();
  const agentNameLower = agentName.toLowerCase();

  // Check for agent name or group words as a whole word (not part of another word)
  // Use word boundary regex to avoid matching "maiden" when looking for "aiden"
  const namePattern = new RegExp(`\\b(${agentNameLower}|all|everyone)\\b`, 'i');
  if (namePattern.test(content)) {
    return true;
  }

  return false;
}

/**
 * Add response guidance to query based on current ACL state
 * @param {string} query - Original query content
 * @param {number} currentACL - Current ACL value
 * @param {number} maxACL - Maximum ACL allowed
 * @param {boolean} debug - Enable debug logging
 * @param {boolean} hasParticipated - Whether agent already participated in thread
 * @param {boolean} wasMentioned - Whether agent was directly mentioned in message
 * @param {boolean} isAuthor - Whether agent authored the message or its immediate parent
 * @param {boolean} noDiscord - Whether discord replies are forbidden
 * @returns {string} - Query with appropriate response guidance
 */
export function addResponseGuidance(query, currentACL, maxACL, debug = false, hasParticipated = false, wasMentioned = false, isAuthor = false, noDiscord = false, mentionsEveryone = false) {

  // No Discord turned on?  Add No Response message.
  if (noDiscord) {
    if (debug) {
      console.log(`noDiscord === true, adding no response message`);
    }
    return query + ACL_NO_RESPONSE_MESSAGE;
  }

  // Calculate effective ACL limit based on conditions
  // Priority: mentioned OR author (3x) > participated (2x) > normal (1x)
  let effectiveMaxACL = maxACL;
  let reason = '';

  if (wasMentioned || isAuthor || mentionsEveryone) {
    effectiveMaxACL = maxACL * 3;
    reason = wasMentioned ? 'mentioned' : (mentionsEveryone ? 'everyone' : 'author');
  } else if (hasParticipated) {
    effectiveMaxACL = maxACL * 2;
    reason = 'participated';
  }

  if (currentACL === effectiveMaxACL) {
    if (debug) {
      console.log(`At ACL limit (${currentACL} === ${effectiveMaxACL}), adding reactions-only message`);
    }
    return query + ACL_REACTIONS_ONLY_MESSAGE;
  } else if (currentACL > effectiveMaxACL) {
    if (debug) {
      console.log(`Beyond ACL limit (${currentACL} > ${effectiveMaxACL}), adding no response message`);
    }
    return query + ACL_NO_RESPONSE_MESSAGE;
  } else if ((wasMentioned || isAuthor || mentionsEveryone || hasParticipated) && currentACL >= maxACL && currentACL < effectiveMaxACL) {
    // Agent is beyond normal limit but within their increased limit
    let message = '';
    if (wasMentioned) {
      message = `\n\nNote: Since you were explicitly mentioned in this message, your ACL limit is ${effectiveMaxACL} (tripled from ${maxACL}).  You are currently at ACL ${currentACL + 1}.`;
    } else if (mentionsEveryone) {
      message = `\n\nNote: Since this message mentions @everyone, your ACL limit is ${effectiveMaxACL} (tripled from ${maxACL}).  You are currently at ACL ${currentACL + 1}.`;
    } else if (isAuthor) {
      message = `\n\nNote: Since you created the message or its parent, your ACL limit is ${effectiveMaxACL} (tripled from ${maxACL}).  You are currently at ACL ${currentACL + 1}.`;
    } else if (hasParticipated) {
      message = `\n\nNote: Since you already participated in this message thread, your ACL limit is ${effectiveMaxACL} (doubled from ${maxACL}).  You are currently at ACL ${currentACL + 1}.`;
    }
    if (debug) {
      console.log(`Agent ${reason} in thread, has ${reason === 'mentioned' || reason === 'author' || reason === 'everyone' ? 'tripled' : 'doubled'} ACL limit: ${effectiveMaxACL}`);
    }
    return query + message + RESPONSE_TAG_GUIDANCE;
  }

  return query + RESPONSE_TAG_GUIDANCE;
}

/**
 * Create Discord embed footer with specified ACL
 * @param {number} acl - The ACL number to use in the footer
 * @returns {string} Footer text with specified ACL
 * @example
 * const footer = createFooter(2);
 * // Returns "acl:2 • Sent by a ZDS AI Agent • zds-agents.com"
 */
export function createFooter(acl) {
  return `acl:${acl} • ${FOOTER_SIGNATURE}`;
}

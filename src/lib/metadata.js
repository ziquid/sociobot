// Metadata encoding/decoding functions for Discord messages

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const FOOTER_SIGNATURE = "Sent by a ZDS AI Agent • zds-agents.com";
const ACL_COURTESY_MESSAGE = "\n\nFor your information only.  Replies to this message will not be processed.";
const ACL_REACTIONS_ONLY_MESSAGE = "\n\nNote: You are at the ACL limit.  You may only respond with a REACTION (e.g., REACTION:eyes) to acknowledge this message.  Text responses will be blocked.";

/**
 * Load server configuration
 * @param {string} guildId - Guild ID
 * @returns {Object|null} Server config or null
 */
function loadServerConfig(guildId) {
  const configPath = join(process.cwd(), 'data', 'servers', `${guildId}.json`);
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    return null;
  }
}

/**
 * Calculate maximum ACL based on number of ZDS bots in channel
 * Can be overridden by MAX_ACL environment variable for per-agent limits
 * @param {Object} channel - Discord channel object
 * @param {boolean} debug - Enable debug logging
 * @returns {number} Maximum ACL allowed
 */
export function getMaxACL(channel, debug = false) {
  // Check for per-agent ACL limit override
  if (process.env.MAX_ACL) {
    const agentMaxACL = parseInt(process.env.MAX_ACL);
    if (!isNaN(agentMaxACL) && agentMaxACL > 0) {
      if (debug) {
        console.log(`[getMaxACL] Using agent-specific MAX_ACL: ${agentMaxACL}`);
      }
      return agentMaxACL;
    }
  }

  if (!channel.guild) return 3; // Default for DMs

  const serverConfig = loadServerConfig(channel.guild.id);
  if (!serverConfig?.zdsAiAgentsRoleId) return 3; // Default if no config

  const zdsBotCount = channel.guild.members.cache.filter(member => {
    if (!member.user.bot) return false;
    if (!member.roles.cache.has(serverConfig.zdsAiAgentsRoleId)) return false;
    return channel.permissionsFor(member)?.has('ViewChannel');
  }).size;

  const maxACL = Math.max(1, 6 - zdsBotCount);
  if (debug) {
    console.log(`[getMaxACL] Guild: ${channel.guild.name}, ZDS bots: ${zdsBotCount}, maxACL: ${maxACL}`);
  }
  return maxACL;
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
 * Add response guidance to query based on current ACL state
 * @param {string} query - Original query content
 * @param {number} currentACL - Current ACL value
 * @param {number} maxACL - Maximum ACL allowed
 * @param {boolean} debug - Enable debug logging
 * @returns {string} - Query with appropriate response guidance
 */
export function addResponseGuidance(query, currentACL, maxACL, debug = false) {
  if (currentACL === maxACL) {
    if (debug) {
      console.log(`At ACL limit (${currentACL} === ${maxACL}), adding reactions-only message`);
    }
    return query + ACL_REACTIONS_ONLY_MESSAGE;
  } else if (currentACL > maxACL) {
    if (debug) {
      console.log(`Beyond ACL limit (${currentACL} > ${maxACL}), adding courtesy message`);
    }
    return query + ACL_COURTESY_MESSAGE;
  }
  return query;
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

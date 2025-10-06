// Metadata encoding/decoding functions for Discord messages

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const FOOTER_SIGNATURE = "Sent by a ZDS AI Agent • zds-agents.com";
const ACL_COURTESY_MESSAGE = "\n\nFor your information only.  Replies to this message will not be processed.";

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
 * @param {Object} channel - Discord channel object
 * @returns {number} Maximum ACL allowed
 */
export function getMaxACL(channel) {
  if (!channel.guild) return 3; // Default for DMs
  
  const serverConfig = loadServerConfig(channel.guild.id);
  if (!serverConfig?.zdsAiAgentsRoleId) return 3; // Default if no config
  
  const members = channel.guild.members.cache;
  const zdsBotCount = members.filter(member => {
    if (!member.user.bot) return false;
    return member.roles.cache.has(serverConfig.zdsAiAgentsRoleId);
  }).size;
  
  return Math.max(1, 6 - zdsBotCount);
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
 * Add courtesy message to query
 * @param {string} query - Original query content
 * @returns {string} - Query with courtesy message
 */
export function addCourtesyMessage(query) {
  return query + ACL_COURTESY_MESSAGE;
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

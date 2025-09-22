// Metadata encoding/decoding functions for Discord messages

/** @constant {number} Maximum ACL (Agent Chain Length) before blocking sends */
export const MAX_ACL = 4;

const FOOTER_SIGNATURE = "Sent by a ZDS AI Agent • zds-agents.com";
const ACL_COURTESY_MESSAGE = "\n\nFor your information only.  Replies to this message will not be processed.";

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

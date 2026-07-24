/**
 * @fileoverview Message processing utilities for Discord bot
 * Handles message filtering, error detection, channel utilities, and debug helpers
 */

/**
 * Create a filter function to check if a message is from the bot's own account
 * @param {string} botUserId - The bot's user ID
 * @returns {Function} Filter function that returns true if message is from the bot
 * @example
 * const messages = await channel.messages.fetch();
 * const ownMessages = messages.filter(isOwnBotMessage(client.user.id));
 */
export const isOwnBotMessage = (botUserId) => (msg) => msg.author.id === botUserId;

/**
 * Create a filter function to check if a message is after a cutoff message ID
 * @param {string|null} cutoffId - The cutoff message ID, or null for no cutoff
 * @returns {Function} Filter function that returns true if message is after cutoff
 * @example
 * const newMessages = messages.filter(isAfterCutoff(lastProcessedId));
 */
export const isAfterCutoff = (cutoffId) => (msg) => !cutoffId || msg.id > cutoffId;

/**
 * Check if a bot-dms message from a bot has a valid agent recipient.
 * Human messages are always valid.  Bot messages must @mention at least one bot user,
 * which serves as the explicit agent recipient in the message header.
 * @param {Object} message - Discord message object
 * @returns {boolean} True if message has a valid agent recipient (or is from a human)
 */
export function hasValidAgentRecipient(message) {
  if (!message.author.bot) return true;
  return message.mentions.users.some(user => user.bot);
}

/**
 * Create a filter function to check if a bot-dms message is relevant to this bot.
 * Messages without a valid agent recipient header (bot @mention) are always dropped.
 * Human messages with a valid header are always relevant.  Bot messages with a valid
 * header are relevant only if they explicitly @mention this bot via Discord ID.
 *
 * Note: name-based text search (wasMentionedInMessage) is intentionally NOT used here.
 * In bot-dms, the explicit <@ID> Discord mention is the authoritative routing signal.
 * Text-based name matching causes false positives when an agent's name appears in a
 * message body addressed to someone else (e.g. a team roster or informational mention).
 *
 * @param {string} botUserId - The bot's user ID
 * @param {string} agentName - Agent name (kept for API compatibility, unused)
 * @returns {Function} Filter function that returns true if message is relevant
 * @example
 * const relevantMessages = messages.filter(isBotDMsRelevant(client.user.id, 'aiden'));
 */
export const isBotDMsRelevant = (botUserId, agentName) => {
  return (msg) => {
    if (msg.author.id === botUserId) return false;
    if (!hasValidAgentRecipient(msg)) return false;
    if (!msg.author.bot) return true;
    return (msg.mentions.users?.has(botUserId));
  };
};

/**
 * Check if a message's content should be suppressed (NO_RESPONSE, zero-width-only, noise phrases).
 * Used in both real-time and batch paths to filter out silent/no-op bot messages.
 * @param {string} content - Raw message content string
 * @returns {boolean} True if the content should be suppressed and not forwarded to the agent
 * @example
 * const filtered = messages.filter(msg => !isSuppressedMessageContent(msg.content));
 */
export function isSuppressedMessageContent(content) {
  const trimmed = (content || '').trim();
  if (!trimmed) return true;
  if (trimmed.includes('NO_RESPONSE')) return true;
  if (trimmed === '.') return true;
  if (trimmed.startsWith('No response needed')) return true;
  if (trimmed.startsWith('No response required')) return true;
  if (trimmed.startsWith("I understand, but I don't have a specific response.")) return true;
  // Zero-width / invisible characters including U+200E (LRM) used by some bots
  if (/^[\u200B\u200C\u200D\u200E\uFEFF]+$/.test(trimmed)) return true;
  return false;
}

/**
 * Check if a response string indicates a Q CLI error
 * @param {string} response - The response string to check
 * @returns {boolean} True if response indicates an error
 * @example
 * if (isErrorResponse(agentResponse)) {
 *   handleErrorResponse('processing batch');
 * }
 */
export function isErrorResponse(response) {
  return response.includes('Q CLI failed with exit code') ||
         response.includes('Sorry, I encountered an error:');
}

/**
 * Handle error responses by incrementing failure counter and triggering circuit breaker
 * @param {string} context - Description of where the error occurred
 * @param {Object} state - State object containing consecutiveFailures counter
 * @param {number} maxFailures - Maximum failures before circuit breaker triggers
 * @param {Function} logFn - Logging function
 * @example
 * handleErrorResponse('batch processing', { consecutiveFailures: 3 }, 5, console.log);
 */
export function handleErrorResponse(context, state, maxFailures, logFn) {
  state.consecutiveFailures++;
  logFn(`Q CLI error response detected (${state.consecutiveFailures}/${maxFailures}) in ${context}`);
  if (state.consecutiveFailures >= maxFailures) {
    logFn(`Circuit breaker triggered: ${state.consecutiveFailures} consecutive Q CLI errors -- exiting`);
    process.exit(1);
  }
}

/**
 * Get the slowdown setting for a Discord channel
 * @param {string} channelId - The channel ID to check
 * @param {Object} client - Discord client instance
 * @returns {Promise<number>} Slowdown in seconds, or 0 if none
 * @example
 * const slowdown = await getChannelSlowdown(message.channel.id, client);
 * const delay = slowdown > 0 ? (slowdown + 1) * 1000 : BOT_MESSAGE_DELAY;
 */
export async function getChannelSlowdown(channelId, client) {
  try {
    const channel = await client.channels.fetch(channelId);
    return channel.rateLimitPerUser || 0;
  } catch (error) {
    console.error(`Failed to fetch channel ${channelId}:`, error);
    return 0; // Fallback to no slowdown
  }
}

/**
 * Debug logging for bot-dms message routing decisions
 * @param {Array} messages - Array of Discord messages to analyze
 * @param {string} botUserId - The bot's user ID
 * @param {boolean} debugEnabled - Whether debug output is enabled
 * @param {Function} logFn - Logging function
 * @param {string} agentName - Agent name (required)
 * @example
 * debugBotDMsRouting(messageArray, client.user.id, DEBUG, console.log, 'aiden');
 */
export function debugBotDMsRouting(messages, botUserId, debugEnabled, logFn, agentName) {
  if (!agentName) {
    console.error('debugBotDMsRouting: agentName is required');
    process.exit(1);
  }
  if (!debugEnabled) return;
  logFn(`\nBot-DMs routing debug:`);
  messages.forEach(msg => {
    const isRelevant = isBotDMsRelevant(botUserId, agentName)(msg);
    const isOwnBot = msg.author.id === botUserId;
    let reason = '';
    if (isOwnBot) reason = 'own bot message';
    else if (msg.mentions.users?.has(botUserId)) reason = 'mentions agent';
    else reason = 'not addressed to this bot';

    logFn(`  Message ${msg.id} from ${msg.author.username}: bot=${msg.author.bot}, relevant=${isRelevant}`);
    logFn(`    -> ${reason.toUpperCase()}`);
  });
}

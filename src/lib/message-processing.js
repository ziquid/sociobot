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
 * Create a filter function to check if a bot-dms message is relevant to this bot
 * Relevant messages are: human messages, mentions of the bot, or replies to the bot
 * @param {string} botUserId - The bot's user ID
 * @returns {Function} Filter function that returns true if message is relevant
 * @example
 * const relevantMessages = messages.filter(isBotDMsRelevant(client.user.id));
 */
export const isBotDMsRelevant = (botUserId) => (msg) => {
  if (msg.author.id === botUserId) return false;
  if (!msg.author.bot) return true;
  if (msg.mentions.has({ id: botUserId })) return true;
  return false;
};

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
    logFn(`Circuit breaker triggered: ${state.consecutiveFailures} consecutive Q CLI errors - exiting`);
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
 * @example
 * debugBotDMsRouting(messageArray, client.user.id, DEBUG, console.log);
 */
export function debugBotDMsRouting(messages, botUserId, debugEnabled, logFn) {
  if (!debugEnabled) return;
  logFn(`\nBot-DMs routing debug:`);
  messages.forEach(msg => {
    const isRelevant = isBotDMsRelevant(botUserId)(msg);
    const isOwnBot = msg.author.id === botUserId;
    let reason = '';
    if (isOwnBot) reason = 'own bot message';
    else if (!msg.author.bot) reason = 'human message';
    else if (msg.mentions.has({ id: botUserId })) reason = 'mentions bot';
    else reason = 'other bot message';

    logFn(`  Message ${msg.id} from ${msg.author.username}: bot=${msg.author.bot}, relevant=${isRelevant}`);
    logFn(`    -> ${reason.toUpperCase()}`);
  });
}
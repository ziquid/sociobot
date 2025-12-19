#!/usr/bin/env node

import { showHelp } from './lib/help.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Check for version option
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
  console.log(packageJson.version);
  process.exit(0);
}

// Check for help option
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Load agent-specific .env file
const agentName = process.argv[2] || process.env.AGENT_NAME;
if (!agentName) {
  console.error('Error: Agent name must be specified as first argument or AGENT_NAME environment variable');
  console.error('Usage: node discord-bot.js <agent-name>');
  console.error('Use --help for more information');
  process.exit(1);
}

// Load configuration
import { getConfig } from "./lib/config.js";
const config = getConfig(agentName);

// Set MAX_ACL environment variable for metadata.js compatibility
if (config.maxAcl !== undefined) {
  process.env.MAX_ACL = String(config.maxAcl);
}

// Validate configuration
import { validEnvironment } from "./lib/validation.js";
if (!validEnvironment(agentName)) {
  process.exit(1);
}

import { Client, Events, GatewayIntentBits, ChannelType, Partials } from "discord.js";

import { loadLastProcessedMessages, saveLastProcessedMessage } from "./lib/persistence.js";
import { processBatchedMessages, processRealtimeMessage, log, encodeSpeech } from "./lib/qcli.js";
import { setupErrorHandlers } from "./lib/error-handlers.js";
import { sendLongMessage, stripThinkTags } from "./lib/message-utils.js";
import { getACL, getMaxACL, addCourtesyMessage } from "./lib/metadata.js";
import {
  isOwnBotMessage,
  isAfterCutoff,
  isBotDMsRelevant,
  isErrorResponse,
  handleErrorResponse,
  getChannelSlowdown,
  debugBotDMsRouting
} from "./lib/message-processing.js";
import { checkLoadAverage } from "./lib/system-utils.js";

// Configuration constants
const DISCORD_TOKEN = config.discord.token;
const AGENT_NAME = agentName;
const BOT_MESSAGE_DELAY = config.messageDelay;
const BOT_DMS_CHANNEL_ID = '1418032549430558782'; // Special channel for bot-to-bot communication

// Bot responds to all messages in channels where it has ViewChannel permission

// Check for run-once mode
const NO_MONITORING = process.argv.includes('--no-monitoring') || process.argv.includes('-1');
const DEBUG = process.argv.includes('--debug');
// Parse scope parameter
const scopeArg = process.argv.find(arg => arg.startsWith('--scope='));
const SCOPE_LIST = scopeArg ? scopeArg.split('=')[1].split(',') : ['all'];
const SCOPE = SCOPE_LIST.includes('all') ? 'all' : SCOPE_LIST;

// Helper functions for scope checking
const shouldProcessDMs = () => SCOPE === 'all' || SCOPE.includes('dms');
const shouldProcessBotDMs = () => SCOPE === 'all' || SCOPE.includes('botdms');
const shouldProcessText = () => SCOPE === 'all' || SCOPE.includes('text');
const NO_DISCORD = process.argv.includes('--no-discord');
const NO_AGENT = process.argv.includes('--no-agent');
const CLEAR_BACKLOG = process.argv.includes('--clear-backlog');
const SHOW_BACKLOG = process.argv.includes('--show-backlog');

// Circuit breaker constants
const MAX_FAILURES = 5;
const MAX_LOAD_AVERAGE = 21;
const MESSAGE_FETCH_LIMIT = 20;
let consecutiveFailures = 0;
let startupComplete = false;
const messageQueue = [];

// Common emoji name to Unicode mapping
const EMOJI_MAP = {
  'thumbsup': '👍',
  'thumbsdown': '👎',
  'heart': '❤️',
  'heart_eyes': '😍',
  '100': '💯',
  'fire': '🔥',
  'eyes': '👀',
  'thinking': '🤔',
  'tada': '🎉',
  'rocket': '🚀',
  'ship': '🚢',
  'cruise_ship': '🛳️',
  'star': '⭐',
  'check': '✅',
  'x': '❌',
  'wave': '👋',
  'waves': '👋',
  'clap': '👏',
  'pray': '🙏',
  'muscle': '💪',
  'brain': '🧠',
  'bulb': '💡',
  'warning': '⚠️',
  'question': '❓',
  'exclamation': '❗',
  'laughing': '😂',
  'smile': '😊',
  'grin': '😁',
  'joy': '😂',
  'rofl': '🤣',
  'sunglasses': '😎',
  'sob': '😭',
  'scream': '😱',
  'flushed': '😳',
  'shrug': '🤷'
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction
  ],
});

// Circuit breaker state
const circuitBreakerState = { consecutiveFailures };

// Process missed messages in a single channel
async function processChannelMessages(channel, lastProcessedId, readyClient) {
  // Circuit breaker - stop if failing repeatedly
  if (circuitBreakerState.consecutiveFailures >= MAX_FAILURES) {
    log(`Circuit breaker: ${circuitBreakerState.consecutiveFailures} failures - exiting`);
    process.exit(1);
  }

  const fetchOptions = { limit: MESSAGE_FETCH_LIMIT };
  if (lastProcessedId) {
    fetchOptions.after = lastProcessedId;
  }

  const messages = await channel.messages.fetch(fetchOptions);

  // Use persistence data as primary source, fall back to bot message analysis
  let cutoffMessageId = lastProcessedId;

  if (!cutoffMessageId) {
    // Only use bot message analysis if no persistence data exists
    const botMessages = messages.filter(msg => msg.author.id === readyClient.user.id);
    if (botMessages.size > 0) {
      const mostRecentBotMessage = botMessages.first();
      log(`Most recent bot message ID: ${mostRecentBotMessage.id}`);
      log(`Bot message reference: ${mostRecentBotMessage.reference?.messageId || 'undefined'}`);
      if (mostRecentBotMessage.reference?.messageId) {
        cutoffMessageId = mostRecentBotMessage.reference.messageId;
      } else {
        cutoffMessageId = mostRecentBotMessage.id;
      }
    }
  }

  log(`Using cutoff message ID: ${cutoffMessageId}`);

  const newMessages = messages
    .filter(msg => {
      if (DEBUG) {
        const isBot = msg.author.bot;
        const isOwnBot = msg.author.id === readyClient.user.id;
        const isAfterCutoffCheck = isAfterCutoff(cutoffMessageId)(msg);
        log(`Message ${msg.id} from ${msg.author.username}: bot=${isBot}, ownBot=${isOwnBot}, afterCutoff=${isAfterCutoffCheck}, webhookId=${msg.webhookId || 'none'}`);

        let reason = '';
        if (isOwnBot) reason = 'own bot message';
        else if (!isAfterCutoffCheck) reason = 'before cutoff';
        else reason = 'will process';

        log(`  -> ${reason.toUpperCase()}`);
      }
      return true;
    })
    .filter(isAfterCutoff(cutoffMessageId))
    .filter(msg => !isOwnBotMessage(readyClient.user.id)(msg));

  if (newMessages.size > 0) {
    const sortedMessages = Array.from(newMessages.values()).sort((a, b) => a.id - b.id);

    // Step 1: Fetch messages (already done above)
    log(`Step 1: Fetched ${sortedMessages.length} messages`);

    if (NO_AGENT) {
      // Skip agent processing
      log(`Step 2: Skipped agent processing (--no-agent)`);
      log(`Step 3: Skipped Discord forwarding (no responses to forward)`);
      return sortedMessages.length;
    }

    // Step 2: Send to agent
    log(`Step 2: Sending ${sortedMessages.length} messages to agent`);
    const responses = await processBatchedMessages(sortedMessages, channel, AGENT_NAME, DEBUG, NO_DISCORD);

    if (NO_DISCORD) {
      // Skip Discord forwarding
      log(`Step 3: Skipped Discord forwarding (--no-discord)`);
      return sortedMessages.length;
    }

    // Step 3: Forward agent responses to Discord
    log(`Step 3: Forwarding ${responses.length} responses to Discord`);
    const messageMap = new Map(sortedMessages.map(msg => [msg.id, msg]));
    let highestProcessedId = null;

    for (const response of responses) {
      const message = messageMap.get(response.messageId);
      if (message && response.response) {
        const responseText = stripThinkTags(response.response).trim();
        const aclLimited = response.aclLimited || false;

        // Check for NO_RESPONSE directive
        if (responseText === 'NO_RESPONSE') {
          log(`Agent returned NO_RESPONSE - skipping Discord reply for message ${response.messageId}`);
          if (!highestProcessedId || message.id > highestProcessedId) {
            highestProcessedId = message.id;
          }
          saveLastProcessedMessage(AGENT_NAME, channel.id, message.id);
          continue;
        }

        // Check for REACTION directive (e.g., REACTION:thumbsup:)
        if (responseText.startsWith('REACTION:')) {
          let emoji = responseText.substring('REACTION:'.length);
          // Remove wrapping colons - Discord.js expects emoji name without colons, or Unicode emoji
          emoji = emoji.replace(/^:|:$/g, '');
          // Map common emoji names to Unicode
          emoji = EMOJI_MAP[emoji.toLowerCase()] || emoji;
          log(`Agent returned REACTION directive - reacting to message ${response.messageId} with ${emoji}`);
          try {
            await message.react(emoji);
            log(`Reaction SUCCESS for message ${response.messageId}: ${emoji}`);
          } catch (error) {
            log(`Reaction FAILED for message ${response.messageId} with ${emoji}: ${error.message}`);
          }
          if (!highestProcessedId || message.id > highestProcessedId) {
            highestProcessedId = message.id;
          }
          saveLastProcessedMessage(AGENT_NAME, channel.id, message.id);
          continue;
        }

        // If ACL limited and not a REACTION, block the text response
        if (aclLimited) {
          log(`Blocking text response to message ${response.messageId} (at ACL limit, reactions only)`);
          if (!highestProcessedId || message.id > highestProcessedId) {
            highestProcessedId = message.id;
          }
          saveLastProcessedMessage(AGENT_NAME, channel.id, message.id);
          continue;
        }

        if (isErrorResponse(responseText)) {
          handleErrorResponse(`batch processing message ${response.messageId}`, circuitBreakerState, MAX_FAILURES, log);
          continue;
        }

        try {
          await sendLongMessage(message, responseText, DEBUG);
          log(`Discord delivery SUCCESS for message ${response.messageId}`);
          if (!highestProcessedId || message.id > highestProcessedId) {
            highestProcessedId = message.id;
          }
          // Save persistence immediately after successful delivery
          saveLastProcessedMessage(AGENT_NAME, channel.id, message.id);
        } catch (error) {
          log(`Discord delivery FAILED for message ${response.messageId}: ${error.message}`);
        }
      }
    }

    // For messages without responses, they're considered processed
    const responseMessageIds = new Set(responses.map(r => r.messageId));
    for (const message of sortedMessages) {
      if (!responseMessageIds.has(message.id)) {
        if (!highestProcessedId || message.id > highestProcessedId) {
          highestProcessedId = message.id;
        }
      }
    }

    // Update last processed message ID for all processed messages
    if (sortedMessages.length > 0) {
      const lastProcessedId = sortedMessages[sortedMessages.length - 1].id;
      saveLastProcessedMessage(AGENT_NAME, channel.id, lastProcessedId);
    }
  }

  return newMessages.size;
}

// Get all DM channels (cached + environment)
async function getDMChannels(readyClient) {
  const dmChannels = new Map();

  // Add cached DM channels
  const cachedDMs = readyClient.channels.cache.filter(channel =>
    channel.type === ChannelType.DM
  );
  if (DEBUG) log(`Found ${cachedDMs.size} cached DM channels`);
  for (const [id, channel] of cachedDMs) {
    dmChannels.set(id, channel);
    if (DEBUG) log(`Added cached DM channel ${id} with ${channel.recipient?.tag}`);
  }

  // Get DM channel IDs from configuration
  const knownDMChannels = config.discord.dmChannelIds;
  if (DEBUG) log(`Configuration DM channel IDs: ${knownDMChannels.join(', ')}`);

  for (const channelId of knownDMChannels) {
    if (DEBUG) log(`Checking DM channel ${channelId}`);
    if (!dmChannels.has(channelId)) {
      try {
        const channel = await readyClient.channels.fetch(channelId);
        if (channel && channel.type === ChannelType.DM) {
          dmChannels.set(channelId, channel);
          if (DEBUG) log(`Added fetched DM channel ${channelId} with ${channel.recipient?.tag}`);
        } else {
          if (DEBUG) log(`Channel ${channelId} is not a DM channel (type: ${channel?.type})`);
        }
      } catch (error) {
        log(`Could not fetch DM channel ${channelId}: ${error.message}`);
      }
    } else {
      if (DEBUG) log(`DM channel ${channelId} already in cache`);
    }
  }

  return dmChannels;
}

// Check DM channels for missed messages
async function checkDMChannels(readyClient, lastMessages) {
  try {
    const dmChannels = await getDMChannels(readyClient);

    log(`Checking ${dmChannels.size} DM channels for missed messages`);

    for (const [channelId, channel] of dmChannels) {
      try {
        if (DEBUG) log(`Processing DM channel ${channelId} with ${channel.recipient?.tag}, lastProcessed: ${lastMessages[channelId] || 'none'}`);
        const processedCount = await processChannelMessages(channel, lastMessages[channelId], readyClient);
        if (processedCount > 0) {
          log(`Found ${processedCount} new DM messages from ${channel.recipient?.tag}`);
        }
      } catch (error) {
        log(`Error checking DM channel: ${error.message}`);
      }
    }
  } catch (error) {
    log(`Error checking DMs: ${error}`);
  }
}

// Check bot-dms channel for messages that mention us, are replies to us, or are from humans
async function checkBotDMsChannel(readyClient, lastMessages) {
  try {
    const channel = await readyClient.channels.fetch(BOT_DMS_CHANNEL_ID);
    if (!channel) {
      log(`Could not fetch bot-dms channel ${BOT_DMS_CHANNEL_ID}`);
      return;
    }

    log(`Checking bot-dms channel for relevant messages`);

    const fetchOptions = { limit: MESSAGE_FETCH_LIMIT };
    const lastProcessedId = lastMessages[BOT_DMS_CHANNEL_ID];
    if (lastProcessedId) {
      fetchOptions.after = lastProcessedId;
    }

    const messages = await channel.messages.fetch(fetchOptions);

    // Filter for relevant messages and check replies
    const relevantMessages = [];
    const messageArray = Array.from(messages.values());

    if (DEBUG) {
      log('Bot-dms filtering debug:');
      messageArray.forEach(msg => {
        const isRelevant = isBotDMsRelevant(readyClient.user.id)(msg);
        const isOwnBot = msg.author.id === readyClient.user.id;
        let reason = '';
        if (isOwnBot) reason = 'own bot message';
        else if (!msg.author.bot) reason = 'human message';
        else if (msg.mentions.has({ id: readyClient.user.id })) reason = 'mentions bot';
        else reason = 'other bot message';

        log(`Message ${msg.id} from ${msg.author.username}: bot=${msg.author.bot}, relevant=${isRelevant}`);
        log(`  -> ${reason.toUpperCase()}`);
      });
    }

    for (const message of messageArray.filter(isBotDMsRelevant(readyClient.user.id))) {
      // Check if it's a reply to our message
      if (message.reference?.messageId) {
        try {
          const referencedMessage = await channel.messages.fetch(message.reference.messageId);
          if (referencedMessage.author.id === readyClient.user.id) {
            relevantMessages.push(message);
            continue;
          }
        } catch (error) {
          // Ignore if we can't fetch the referenced message
        }
      }
      relevantMessages.push(message);
    }

    if (relevantMessages.length > 0) {
      const sortedMessages = relevantMessages.sort((a, b) => a.id - b.id);
      log(`Found ${sortedMessages.length} relevant messages in bot-dms channel`);

      // Process the relevant messages
      const responses = await processBatchedMessages(sortedMessages, channel, AGENT_NAME, DEBUG, NO_DISCORD);

      if (!NO_DISCORD) {
        // Send responses to Discord
        const messageMap = new Map(sortedMessages.map(msg => [msg.id, msg]));
        let highestProcessedId = null;

        for (const response of responses) {
          const message = messageMap.get(response.messageId);
          if (message && response.response) {
            const responseText = stripThinkTags(response.response).trim();

            // Check for NO_RESPONSE directive
            if (responseText === 'NO_RESPONSE') {
              log(`Agent returned NO_RESPONSE - skipping Discord reply for bot-dms message ${response.messageId}`);
              if (!highestProcessedId || message.id > highestProcessedId) {
                highestProcessedId = message.id;
              }
              saveLastProcessedMessage(AGENT_NAME, BOT_DMS_CHANNEL_ID, message.id);
              continue;
            }

            // Check for REACTION directive (e.g., REACTION:thumbsup:)
            if (responseText.startsWith('REACTION:')) {
              let emoji = responseText.substring('REACTION:'.length);
              // Remove wrapping colons - Discord.js expects emoji name without colons, or Unicode emoji
              emoji = emoji.replace(/^:|:$/g, '');
              // Map common emoji names to Unicode
              emoji = EMOJI_MAP[emoji.toLowerCase()] || emoji;
              log(`Agent returned REACTION directive - reacting to bot-dms message ${response.messageId} with ${emoji}`);
              try {
                await message.react(emoji);
                log(`Reaction SUCCESS for bot-dms message ${response.messageId}: ${emoji}`);
              } catch (error) {
                log(`Reaction FAILED for bot-dms message ${response.messageId} with ${emoji}: ${error.message}`);
              }
              if (!highestProcessedId || message.id > highestProcessedId) {
                highestProcessedId = message.id;
              }
              saveLastProcessedMessage(AGENT_NAME, BOT_DMS_CHANNEL_ID, message.id);
              continue;
            }

            if (isErrorResponse(responseText)) {
              handleErrorResponse(`bot-dms processing message ${response.messageId}`, circuitBreakerState, MAX_FAILURES, log);
              continue;
            }

            try {
              await sendLongMessage(message, responseText, DEBUG);
              log(`Bot-dms Discord delivery SUCCESS for message ${response.messageId}`);
              if (!highestProcessedId || message.id > highestProcessedId) {
                highestProcessedId = message.id;
              }
              // Save persistence immediately after successful delivery
              saveLastProcessedMessage(AGENT_NAME, BOT_DMS_CHANNEL_ID, message.id);
            } catch (error) {
              log(`Bot-dms Discord delivery FAILED for message ${response.messageId}: ${error.message}`);
            }
          }
        }

        // For messages without responses, they're considered processed
        const responseMessageIds = new Set(responses.map(r => r.messageId));
        for (const message of sortedMessages) {
          if (!responseMessageIds.has(message.id)) {
            if (!highestProcessedId || message.id > highestProcessedId) {
              highestProcessedId = message.id;
            }
          }
        }

        // Update last processed message ID for all processed messages
        if (sortedMessages.length > 0) {
          const lastProcessedId = sortedMessages[sortedMessages.length - 1].id;
          saveLastProcessedMessage(AGENT_NAME, BOT_DMS_CHANNEL_ID, lastProcessedId);
        }
      }
    }
  } catch (error) {
    log(`Error checking bot-dms channel: ${error}`);
  }
}

// Show backlog messages without processing
async function showBacklog(readyClient, lastMessages) {
  log('Showing backlog messages (no processing)');
  let totalBacklog = 0;

  if (shouldProcessDMs()) {
    // Show DM backlog
    const dmChannels = await getDMChannels(readyClient);

    for (const [channelId, channel] of dmChannels) {
      try {
        const fetchOptions = { limit: MESSAGE_FETCH_LIMIT };
        const lastProcessedId = lastMessages[channelId];
        if (lastProcessedId) {
          fetchOptions.after = lastProcessedId;
        }

        const messages = await channel.messages.fetch(fetchOptions);
        const newMessages = messages.filter(msg => !isOwnBotMessage(readyClient.user.id)(msg));

        if (newMessages.size > 0) {
          console.log(`\nDM with ${channel.recipient?.tag}: ${newMessages.size} messages`);
          Array.from(newMessages.values()).sort((a, b) => a.id - b.id).forEach(msg => {
            const timestamp = msg.createdAt.toLocaleString('en-US', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
            console.log(`  ${timestamp} ${msg.author.username}: ${msg.content.substring(0, 100)}`);
          });
          totalBacklog += newMessages.size;
        }
      } catch (error) {
        log(`Error showing DM backlog for ${channelId}: ${error.message}`);
      }
    }
  }

  if (shouldProcessBotDMs()) {
    // Show bot-dms backlog
    try {
      const channel = await readyClient.channels.fetch(BOT_DMS_CHANNEL_ID);
      if (channel) {
        const fetchOptions = { limit: MESSAGE_FETCH_LIMIT };
        const lastProcessedId = lastMessages[BOT_DMS_CHANNEL_ID];
        if (lastProcessedId) {
          fetchOptions.after = lastProcessedId;
        }

        const messages = await channel.messages.fetch(fetchOptions);

        // Filter for relevant messages and check replies
        const relevantMessages = [];
        const messageArray = Array.from(messages.values());

        for (const message of messageArray.filter(isBotDMsRelevant(readyClient.user.id))) {
          if (DEBUG) {
            const isBot = message.author.bot;
            const isOwnBot = message.author.id === readyClient.user.id;
            let reason = '';
            if (isOwnBot) reason = 'own bot message';
            else if (!message.author.bot) reason = 'human message';
            else if (message.mentions.has({ id: readyClient.user.id })) reason = 'mentions bot';
            else reason = 'other bot message';

            log(`Message ${message.id} from ${message.author.username}: bot=${isBot}, relevant=true`);
            log(`  -> ${reason.toUpperCase()}`);
          }

          // Check if it's a reply to our message
          if (message.reference?.messageId) {
            try {
              const referencedMessage = await channel.messages.fetch(message.reference.messageId);
              if (referencedMessage.author.id === readyClient.user.id) {
                relevantMessages.push(message);
                continue;
              }
            } catch (error) {
              // Ignore if we can't fetch the referenced message
            }
          }
          relevantMessages.push(message);
        }

        const relevantMessagesCollection = { size: relevantMessages.length, forEach: (fn) => relevantMessages.forEach(fn) };

        if (relevantMessagesCollection.size > 0) {
          console.log(`\nBot-DMs channel: ${relevantMessagesCollection.size} messages`);
          relevantMessages.sort((a, b) => a.id - b.id).forEach(msg => {
            const timestamp = msg.createdAt.toLocaleString('en-US', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
            console.log(`  ${timestamp} ${msg.author.username}: ${msg.content.substring(0, 100)}`);
          });
          totalBacklog += relevantMessagesCollection.size;
        }
      }
    } catch (error) {
      log(`Error showing bot-dms backlog: ${error.message}`);
    }
  }

  if (shouldProcessText()) {
    // Show guild backlog
    const guilds = await readyClient.guilds.fetch();
    for (const [guildId, guild] of guilds) {
      const fullGuild = await readyClient.guilds.fetch(guildId);
      const channels = await fullGuild.channels.fetch();
      const textChannels = channels.filter(channel =>
        channel.type === ChannelType.GuildText && channel.permissionsFor(readyClient.user)?.has('ViewChannel')
      );

      for (const [channelId, channel] of textChannels) {
        try {
          const fetchOptions = { limit: MESSAGE_FETCH_LIMIT };
          const lastProcessedId = lastMessages[channelId];
          if (lastProcessedId) {
            fetchOptions.after = lastProcessedId;
          }

          const messages = await channel.messages.fetch(fetchOptions);
          const newMessages = messages.filter(msg => !isOwnBotMessage(readyClient.user.id)(msg));

          if (newMessages.size > 0) {
            console.log(`\n${fullGuild.name}/#${channel.name}: ${newMessages.size} messages`);
            Array.from(newMessages.values()).sort((a, b) => a.id - b.id).forEach(msg => {
              const timestamp = msg.createdAt.toLocaleString('en-US', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
              });
              console.log(`  ${timestamp} ${msg.author.username}: ${msg.content.substring(0, 100)}`);
            });
            totalBacklog += newMessages.size;
          }
        } catch (error) {
          log(`Error showing guild backlog for ${channel.name}: ${error.message}`);
        }
      }
    }
  }

  console.log(`\nTotal backlog: ${totalBacklog} messages`);
}

// Clear backlog by marking latest messages as processed
async function clearBacklog(readyClient) {
  log('Clearing backlog - marking all current messages as processed');

  if (shouldProcessDMs()) {
    // Clear DM channels
    const dmChannels = await getDMChannels(readyClient);

    for (const [channelId, channel] of dmChannels) {
      try {
        const messages = await channel.messages.fetch({ limit: 1 });
        if (messages.size > 0) {
          const latestMessage = messages.first();
          saveLastProcessedMessage(AGENT_NAME, channelId, latestMessage.id);
          log(`Cleared DM backlog for ${channel.recipient?.tag}: ${latestMessage.id}`);
        }
      } catch (error) {
        log(`Error clearing DM backlog for ${channelId}: ${error.message}`);
      }
    }
  }

  if (shouldProcessBotDMs()) {
    // Clear bot-dms channel
    try {
      const channel = await readyClient.channels.fetch(BOT_DMS_CHANNEL_ID);
      if (channel) {
        const messages = await channel.messages.fetch({ limit: 1 });
        if (messages.size > 0) {
          const latestMessage = messages.first();
          saveLastProcessedMessage(AGENT_NAME, BOT_DMS_CHANNEL_ID, latestMessage.id);
          log(`Cleared bot-dms backlog: ${latestMessage.id}`);
        }
      }
    } catch (error) {
      log(`Error clearing bot-dms backlog: ${error.message}`);
    }
  }

  if (shouldProcessText()) {
    // Clear guild channels
    const guilds = await readyClient.guilds.fetch();
    for (const [guildId, guild] of guilds) {
      const fullGuild = await readyClient.guilds.fetch(guildId);
      const channels = await fullGuild.channels.fetch();
      const textChannels = channels.filter(channel =>
        channel.type === ChannelType.GuildText && channel.permissionsFor(readyClient.user)?.has('ViewChannel')
      );

      for (const [channelId, channel] of textChannels) {
        try {
          const messages = await channel.messages.fetch({ limit: 1 });
          if (messages.size > 0) {
            const latestMessage = messages.first();
            saveLastProcessedMessage(AGENT_NAME, channelId, latestMessage.id);
            log(`Cleared guild backlog for ${channel.name}: ${latestMessage.id}`);
          }
        } catch (error) {
          log(`Error clearing guild backlog for ${channel.name}: ${error.message}`);
        }
      }
    }
  }

  log('Backlog cleared successfully');
}

// Check guild channels for missed messages
async function checkGuildChannels(readyClient, lastMessages) {
  try {
    const guilds = await readyClient.guilds.fetch();
    log(`Checking ${guilds.size} guilds for missed messages`);

    for (const [guildId, guild] of guilds) {
      const fullGuild = await readyClient.guilds.fetch(guildId);
      const channels = await fullGuild.channels.fetch();
      const textChannels = channels.filter(channel =>
        channel.type === ChannelType.GuildText && channel.permissionsFor(readyClient.user)?.has('ViewChannel')
      );

      log(`Guild ${fullGuild.name}: checking ${textChannels.size} text channels`);

      for (const [channelId, channel] of textChannels) {
        try {
          const processedCount = await processChannelMessages(channel, lastMessages[channelId], readyClient);
          if (processedCount > 0) {
            log(`Found ${processedCount} new messages in channel ${channel.name}`);
          }
        } catch (error) {
          log(`Error checking channel ${channel.name}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    log(`Error checking guild channels: ${error}`);
  }
}

async function handleLowPriorityMessage(message) {
  const channelSlowdown = await getChannelSlowdown(message.channel.id, client);
  const baseDelay = channelSlowdown > 0 ?
    (channelSlowdown + 1) * 1000 : // Add 1sec buffer, convert to ms
    BOT_MESSAGE_DELAY;
  const delay = baseDelay + Math.random() * 3000; // Add up to 3s random
  // log(`Delaying bot message processing by ${Math.round(delay/1000)}s`);
  setTimeout(async () => {
    await handleRealtimeMessage(message);
  }, delay);
}

async function handleRealtimeMessage(message) {
  // Circuit breaker - stop if failing repeatedly
  if (circuitBreakerState.consecutiveFailures >= MAX_FAILURES) {
    log(`Circuit breaker: ${circuitBreakerState.consecutiveFailures} failures, exiting`);
    process.exit(1);
  }

  // Special handling for bot-dms channel: ignore messages from OTHER bots (not our own)
  if (message.channel.id === BOT_DMS_CHANNEL_ID && message.author.bot && message.author.id !== client.user.id) {
    if (DEBUG) log(`ROUTING: Ignoring other bot message in #bot-dms from ${message.author.username}`);
    return;
  }

  const isMention = message.mentions.has(client.user);
  const isDM = message.channel.type === ChannelType.DM;
  const hasViewPermission = message.channel.permissionsFor?.(client.user)?.has('ViewChannel');

  if (DEBUG) {
    const channelName = message.channel.name || `DM with ${message.channel.recipient?.username}`;
    log(`ROUTING: Message ${message.id} from ${message.author.username} in ${channelName}`);
    log(`  -> mention=${isMention}, isDM=${isDM}, hasViewPerm=${hasViewPermission}`);

    let reason = '';
    if (isMention) reason = 'mentioned bot';
    else if (isDM) reason = 'direct message';
    else if (hasViewPermission) reason = 'has view permission';
    else reason = 'no routing criteria met';

    log(`  -> ${reason.toUpperCase()}`);
  }

  if (isMention || isDM || hasViewPermission) {
    let query = message.content;
    if (isMention) {
      // Replace mentions with readable names
      const promises = [];
      query = message.content.replace(/<@!?(\d+)>/g, (match, userId) => {
        const placeholder = `__MENTION_${promises.length}__`;
        promises.push(
          client.users.fetch(userId).then(user => `@${user.username}`).catch(() => match)
        );
        return placeholder;
      });

      const results = await Promise.all(promises);
      results.forEach((result, i) => {
        query = query.replace(`__MENTION_${i}__`, result);
      });

      query = query.trim();
    }

    if (query || message.attachments.size > 0) {
      if (NO_AGENT) {
        log(`Real-time message skipped, agent processing disabled (--no-agent)`);
        return;
      }

      const result = await processRealtimeMessage(message, message.channel, AGENT_NAME, DEBUG, NO_DISCORD);

      if (result && !NO_DISCORD) {
        const responseText = stripThinkTags(typeof result === 'string' ? result : result.response).trim();
        const hadTranscription = typeof result === 'object' ? result.hadTranscription : false;
        const aclLimited = typeof result === 'object' ? result.aclLimited : false;

        // Check for NO_RESPONSE directive
        if (responseText === 'NO_RESPONSE') {
          log(`Agent returned NO_RESPONSE, skipping Discord reply for message ${message.id}`);
          saveLastProcessedMessage(AGENT_NAME, message.channel.id, message.id);
          return;
        }

        // Check for REACTION directive (e.g., REACTION:thumbsup:)
        if (responseText.startsWith('REACTION:')) {
          let emoji = responseText.substring('REACTION:'.length);
          // Remove wrapping colons - Discord.js expects emoji name without colons, or Unicode emoji
          emoji = emoji.replace(/^:|:$/g, '');
          // Map common emoji names to Unicode
          emoji = EMOJI_MAP[emoji.toLowerCase()] || emoji;
          log(`Agent returned REACTION directive, reacting to message ${message.id} with ${emoji}`);
          try {
            await message.react(emoji);
            log(`Reaction SUCCESS for message ${message.id}: ${emoji}`);
          } catch (error) {
            log(`Reaction FAILED for message ${message.id} with ${emoji}: ${error.message}`);
          }
          saveLastProcessedMessage(AGENT_NAME, message.channel.id, message.id);
          return;
        }

        // If ACL limited and not a REACTION, block the text response
        if (aclLimited) {
          log(`Blocking text response to message ${message.id} (at ACL limit, reactions only)`);
          saveLastProcessedMessage(AGENT_NAME, message.channel.id, message.id);
          return;
        }

        if (isErrorResponse(responseText)) {
          handleErrorResponse('realtime processing', circuitBreakerState, MAX_FAILURES, log);
        } else {
          circuitBreakerState.consecutiveFailures = 0; // Reset on successful response
          try {
            // Encode speech if message had transcription
            let audioPath = null;
            if (hadTranscription) {
              if (DEBUG) {
                log(`Message had transcription, encoding speech response for ${AGENT_NAME}`);
              }
              audioPath = encodeSpeech(responseText, AGENT_NAME);
              if (audioPath && DEBUG) {
                log(`Speech encoded successfully: ${audioPath}`);
              } else if (!audioPath) {
                log(`Speech encoding failed, sending text-only response`);
              }
            }

            await sendLongMessage(message, responseText, DEBUG, audioPath);
            log(`Real-time Discord delivery SUCCESS for message ${message.id}${audioPath ? ' with audio' : ''}`);
            // Save persistence immediately after successful delivery
            saveLastProcessedMessage(AGENT_NAME, message.channel.id, message.id);
          } catch (error) {
            log(`Real-time Discord delivery FAILED for message ${message.id}: ${error.message}`);
          }
        }
      } else if (result && NO_DISCORD) {
        log(`Real-time response generated, Discord response skipped`);
      }
    }
  }
}

// Bot ready event
client.once(Events.ClientReady, async (readyClient) => {
  log(`${AGENT_NAME} Discord Bot is ready! Logged in as ${readyClient.user.tag}`);

  if (DEBUG) {
    log(`Bot User ID from Discord: ${readyClient.user.id}`);
    log(`Bot User ID from env: ${process.env.BOT_USER_ID}`);
    log(`IDs match: ${readyClient.user.id === process.env.BOT_USER_ID}`);
  }

  const lastMessages = loadLastProcessedMessages(AGENT_NAME);
  log(`Loaded last processed messages: ${Object.keys(lastMessages).length} channels`);
  if (DEBUG) {
    const channelNames = [];
    for (const channelId of Object.keys(lastMessages)) {
      try {
        const channel = await readyClient.channels.fetch(channelId);
        const name = channel.name || `DM with ${channel.recipient?.username}` || `Unknown`;
        if (DEBUG || name === "Unknown") {
          channelNames.push(`${name} (${channelId})`);
        } else {
          channelNames.push(name);
        }
      } catch (error) {
        channelNames.push(`Unknown (${channelId})`);
      }
    }
    log(`Channels: ${channelNames.join(', ')}`);
  }

  if (SHOW_BACKLOG) {
    await showBacklog(readyClient, lastMessages);
    process.exit(0);
  }

  if (CLEAR_BACKLOG) {
    await clearBacklog(readyClient);
    log('Clear backlog complete, exiting');
    process.exit(0);
  }

  // Fetch guild members in background to populate cache (async, non-blocking)
  readyClient.guilds.fetch().then(guilds => {
    for (const [guildId, guild] of guilds) {
      readyClient.guilds.fetch(guildId).then(fullGuild => {
        fullGuild.members.fetch().then(members => {
          if (DEBUG) {
            log(`Fetched ${members.size} members for ${fullGuild.name}: ${members.map(m => m.user.username).join(', ')}`);
          }
        }).catch(err => log(`Failed to fetch members for ${fullGuild.name}: ${err.message}`));
      });
    }
  });

  // Check for missed messages based on scope
  if (shouldProcessDMs()) {
    await checkDMChannels(readyClient, lastMessages);
  }

  if (shouldProcessBotDMs()) {
    await checkBotDMsChannel(readyClient, lastMessages);
  }

  if (shouldProcessText()) {
    await checkGuildChannels(readyClient, lastMessages);
  }

  // Exit if in no-monitoring mode after checking all channels
  if (NO_MONITORING) {
    log('No-monitoring mode: finished checking all channels, exiting');
    process.exit(0);
  }

  startupComplete = true;
  log('Bot initialization complete, monitoring for new messages...');

  // Process queued messages
  while (messageQueue.length > 0) {
    const queuedMessage = messageQueue.shift();
    if (queuedMessage.author.bot) {
      handleLowPriorityMessage(queuedMessage);
    } else {
      await handleRealtimeMessage(queuedMessage);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (!startupComplete && message.author.id !== client.user.id) {
    messageQueue.push(message);
    return;
  }

  if (message.author.bot) {
    if (message.author.id !== client.user.id) {
      log(`Bot message detected: ${message.id} from ${message.author.username}: ${message.content.substring(0, 300)}`);
    } else {
      log(`Ignoring my own bot message (from ${message.author.username}: ${message.content.substring(0, 300)})`);
      return;
    }
  }

  const channelSlowdown = await getChannelSlowdown(message.channel.id, client);
  if (message.author.bot || channelSlowdown > 0) {
    handleLowPriorityMessage(message);
  } else {
    await handleRealtimeMessage(message);
  }
});

// Handle reaction events
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    // Skip if the reactor is this bot
    if (user.id === client.user.id) {
      if (DEBUG) log(`Skipping self-reaction notification`);
      return;
    }

    // Fetch partial reactions/messages if needed
    if (reaction.partial) {
      await reaction.fetch();
    }
    if (reaction.message.partial) {
      await reaction.message.fetch();
    }

    const message = reaction.message;

    // Get emoji identifier (custom emoji use name, unicode emoji use emoji property)
    const emojiIdentifier = reaction.emoji.id ? `:${reaction.emoji.name}:` : reaction.emoji.name;

    // Truncate message content for notification
    const messagePreview = message.content.substring(0, 500);
    const truncated = message.content.length > 500 ? '...' : '';

    const channelName = message.channel.name || `DM with ${message.channel.recipient?.username}`;
    const messageAuthor = message.author.username;

    log(`Reaction notification: ${user.username} reacted with ${emojiIdentifier} to ${messageAuthor}'s message in ${channelName}`);

    // Send informational notification to the agent (matching format of regular messages)
    const notification = `Reaction added by @${user.username} (ID: ${user.id}) in channel ${channelName} (ID: ${message.channel.id}):

Reacted with ${emojiIdentifier} to message from @${messageAuthor} (ID: ${message.author.id}, Message ID: ${message.id}):
"${messagePreview}${truncated}"

This message is for your information only. Do not reply -- replies to this message will not be processed.`;

    // Process as informational message (no response expected)
    await processRealtimeMessage(
      {
        content: notification,
        author: { username: 'Discord System', id: 'system' },
        id: `reaction-${message.id}-${user.id}-${Date.now()}`,
        channel: message.channel,
        createdAt: new Date(),
        client: client,
        attachments: new Map()
      },
      message.channel,
      AGENT_NAME,
      DEBUG,
      true // noDiscord = true, don't send response back to Discord
    );

  } catch (error) {
    log(`Error handling reaction: ${error.message}`);
  }
});

// Setup error handlers
setupErrorHandlers(client, log);

// Check load every 30 seconds
setInterval(() => checkLoadAverage(MAX_LOAD_AVERAGE, log), 30000);

client.login(DISCORD_TOKEN);

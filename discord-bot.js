#!/usr/bin/env node

import dotenv from 'dotenv';

// Check for help option
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
ZDS Discord Bot - AI Agent Discord Interface

USAGE:
  node discord-bot.js <agent-name> [options]

OPTIONS:
  --run-once, -1     Run once to process missed messages then exit
  --dms-only         Process only DM channels, skip guild channels
  --debug-json       Output JSON responses instead of sending to Discord
  --no-discord       Process messages but skip Discord responses
  --help, -h         Show this help message

EXAMPLES:
  node discord-bot.js mybot                   # Start bot normally
  node discord-bot.js mybot --run-once        # Process missed messages once
  node discord-bot.js mybot --dms-only        # Process only DMs
  node discord-bot.js mybot --debug-json      # Debug mode with JSON output

ENVIRONMENT:
  Each agent requires a .env.<agent-name> file with:
  - DISCORD_TOKEN
  - BOT_USER_ID
  - WEBHOOK_ID
  - WEBHOOK_TOKEN
  - Optional: HTTP_PORT, BOT_MESSAGE_DELAY, DM_CHANNEL_IDS
`);
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
dotenv.config({ path: `.env.${agentName}` });

import { Client, Events, GatewayIntentBits, ChannelType, Partials } from "discord.js";
import { execSync } from "child_process";

import { validateEnvironment } from "./lib/validation.js";
import { loadLastProcessedMessages, saveLastProcessedMessage } from "./lib/persistence.js";
import { processBatchedMessages, processRealtimeMessage, log } from "./lib/qcli.js";
import { startHttpServer } from "./lib/http-server.js";
import { setupErrorHandlers } from "./lib/error-handlers.js";
import { sendLongMessage } from "./lib/message-utils.js";

// Validate environment variables
validateEnvironment();

// Environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const AGENT_NAME = agentName;
const HTTP_PORT = process.env.HTTP_PORT;
const BOT_MESSAGE_DELAY = parseInt(process.env.BOT_MESSAGE_DELAY) || 17000; // Default 17 seconds
const BOT_DMS_CHANNEL_ID = '1418032549430558782'; // Special channel for bot-to-bot communication

// Bot responds to all messages in channels where it has ViewChannel permission

// Check for run-once mode
const RUN_ONCE = process.argv.includes('--run-once') || process.argv.includes('-1');
const DEBUG_JSON = process.argv.includes('--debug-json');
const DMS_ONLY = process.argv.includes('--dms-only');
const NO_DISCORD = process.argv.includes('--no-discord');

// Circuit breaker constants
const MAX_FAILURES = 5;
const MAX_LOAD_AVERAGE = 21;
const MESSAGE_FETCH_LIMIT = 20;
let consecutiveFailures = 0;
let startupComplete = false;
const messageQueue = [];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildWebhooks
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
  ],
});

// Message filtering functions
const isOwnBotMessage = (botUserId) => (msg) => msg.author.id === botUserId;
const isAfterCutoff = (cutoffId) => (msg) => !cutoffId || msg.id > cutoffId;
const isBotDMsRelevant = (botUserId) => (msg) => {
  if (msg.author.id === botUserId) return false;
  if (!msg.author.bot) return true;
  if (msg.mentions.has({ id: botUserId })) return true;
  return false;
};

// Filter out Q CLI error messages and track errors
function isErrorResponse(response) {
  return response.includes('Q CLI failed with exit code') || 
         response.includes('Sorry, I encountered an error:');
}

function handleErrorResponse(context) {
  consecutiveFailures++;
  log(`Q CLI error response detected (${consecutiveFailures}/${MAX_FAILURES}) in ${context}`);
  if (consecutiveFailures >= MAX_FAILURES) {
    log(`Circuit breaker triggered: ${consecutiveFailures} consecutive Q CLI errors - exiting`);
    process.exit(1);
  }
}

// Process missed messages in a single channel
async function processChannelMessages(channel, lastProcessedId, readyClient) {
  // Circuit breaker - stop if failing repeatedly
  if (consecutiveFailures >= MAX_FAILURES) {
    log(`Circuit breaker: ${consecutiveFailures} failures - exiting`);
    process.exit(1);
  }
  
  const fetchOptions = { limit: MESSAGE_FETCH_LIMIT };
  if (lastProcessedId) {
    fetchOptions.after = lastProcessedId;
  }
  
  const messages = await channel.messages.fetch(fetchOptions);
  
  // Find the most recent bot message to determine what's already been processed
  const botMessages = messages.filter(msg => msg.author.id === readyClient.user.id);
  let cutoffMessageId = lastProcessedId;
  
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
  
  log(`Using cutoff message ID: ${cutoffMessageId}`);
  
  const newMessages = messages
    .filter(msg => {
      log(`Message from ${msg.author.username} (ID: ${msg.author.id}): bot=${msg.author.bot}, webhookId=${msg.webhookId || 'none'}`);
      return true;
    })
    .filter(isAfterCutoff(cutoffMessageId))
    .filter(msg => !isOwnBotMessage(readyClient.user.id)(msg));
  
  if (newMessages.size > 0) {
    const sortedMessages = Array.from(newMessages.values()).sort((a, b) => a.id - b.id);
    
    // Process all messages in a single batch
    const responses = await processBatchedMessages(sortedMessages, channel, AGENT_NAME, DEBUG_JSON, NO_DISCORD);
    
    if (!DEBUG_JSON && !NO_DISCORD) {
      // Send responses to Discord
      const messageMap = new Map(sortedMessages.map(msg => [msg.id, msg]));
      let highestProcessedId = null;
      
      for (const response of responses) {
        const message = messageMap.get(response.messageId);
        if (message && response.response) {
          if (isErrorResponse(response.response)) {
            handleErrorResponse(`batch processing message ${response.messageId}`);
            continue;
          }
          
          try {
            await sendLongMessage(message, response.response);
            // Log successful Discord delivery
            log(`Discord delivery SUCCESS for message ${response.messageId}`);
            // Track highest successfully sent message ID
            if (!highestProcessedId || message.id > highestProcessedId) {
              highestProcessedId = message.id;
            }
          } catch (error) {
            log(`Discord delivery FAILED for message ${response.messageId}: ${error.message}`);
            // Don't update highest processed if Discord delivery fails
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
      
      // Update last processed message ID to the highest successfully processed message
      if (highestProcessedId) {
        saveLastProcessedMessage(AGENT_NAME, channel.id, highestProcessedId);
      }
    } else if (NO_DISCORD) {
      log(`Processed ${responses.length} messages - Discord responses skipped, last processed ID not updated`);
    }
  }
  
  return newMessages.size;
}

// Check DM channels for missed messages
async function checkDMChannels(readyClient, lastMessages) {
  try {
    const dmChannels = new Map();
    
    // Add cached DM channels
    const cachedDMs = readyClient.channels.cache.filter(channel => 
      channel.type === ChannelType.DM
    );
    for (const [id, channel] of cachedDMs) {
      dmChannels.set(id, channel);
    }
    
    // Get DM channel IDs from environment
    const knownDMChannels = process.env.DM_CHANNEL_IDS?.split(',') || [];
    
    for (const channelId of knownDMChannels) {
      if (!dmChannels.has(channelId)) {
        try {
          const channel = await readyClient.channels.fetch(channelId);
          if (channel && channel.type === ChannelType.DM) {
            dmChannels.set(channelId, channel);
          }
        } catch (error) {
          log(`Could not fetch DM channel ${channelId}: ${error.message}`);
        }
      }
    }
    
    log(`Checking ${dmChannels.size} DM channels for missed messages`);
    
    for (const [channelId, channel] of dmChannels) {
      try {
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
      const responses = await processBatchedMessages(sortedMessages, channel, AGENT_NAME, DEBUG_JSON, NO_DISCORD);
      
      if (!DEBUG_JSON && !NO_DISCORD) {
        // Send responses to Discord
        const messageMap = new Map(sortedMessages.map(msg => [msg.id, msg]));
        let highestProcessedId = null;
        
        for (const response of responses) {
          const message = messageMap.get(response.messageId);
          if (message && response.response) {
            if (isErrorResponse(response.response)) {
              handleErrorResponse(`bot-dms processing message ${response.messageId}`);
              continue;
            }
            
            try {
              await sendLongMessage(message, response.response);
              log(`Bot-dms Discord delivery SUCCESS for message ${response.messageId}`);
              if (!highestProcessedId || message.id > highestProcessedId) {
                highestProcessedId = message.id;
              }
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
        
        // Update last processed message ID
        if (highestProcessedId) {
          saveLastProcessedMessage(AGENT_NAME, BOT_DMS_CHANNEL_ID, highestProcessedId);
        }
      }
    }
  } catch (error) {
    log(`Error checking bot-dms channel: ${error}`);
  }
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
  const delay = BOT_MESSAGE_DELAY + Math.random() * 3000; // Add up to 3s random
  // log(`Delaying bot message processing by ${Math.round(delay/1000)}s`);
  setTimeout(async () => {
    await handleRealtimeMessage(message);
  }, delay);
}

async function handleRealtimeMessage(message) {
  // Circuit breaker - stop if failing repeatedly
  if (consecutiveFailures >= MAX_FAILURES) {
    log(`Circuit breaker: ${consecutiveFailures} failures - exiting`);
    process.exit(1);
  }
  
  // Special handling for bot-dms channel: ignore messages from OTHER bots (not our own)
  if (message.channel.id === BOT_DMS_CHANNEL_ID && message.author.bot && message.author.id !== client.user.id) {
    log(`Ignoring other bot message in #bot-dms channel from ${message.author.username}`);
    return;
  }
  
  const isMention = message.mentions.has(client.user);
  const isDM = message.channel.type === ChannelType.DM;
  const hasViewPermission = message.channel.permissionsFor?.(client.user)?.has('ViewChannel');
  
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
    
    if (query) {
      const response = await processRealtimeMessage(message, message.channel, AGENT_NAME, DEBUG_JSON, NO_DISCORD);
      
      if (response && !DEBUG_JSON && !NO_DISCORD) {
        if (isErrorResponse(response)) {
          handleErrorResponse('realtime processing');
        } else {
          consecutiveFailures = 0; // Reset on successful response
          try {
            await sendLongMessage(message, response);
            log(`Real-time Discord delivery SUCCESS for message ${message.id}`);
          } catch (error) {
            log(`Real-time Discord delivery FAILED for message ${message.id}: ${error.message}`);
          }
        }
      } else if (response && NO_DISCORD) {
        log(`Real-time response generated - Discord response skipped`);
      }
    }
  }
}

// Bot ready event
client.once(Events.ClientReady, async (readyClient) => {
  log(`${AGENT_NAME} Discord Bot is ready! Logged in as ${readyClient.user.tag}`);
  log(`Bot User ID from Discord: ${readyClient.user.id}`);
  log(`Bot User ID from env: ${process.env.BOT_USER_ID}`);
  log(`IDs match: ${readyClient.user.id === process.env.BOT_USER_ID}`);
  
  const lastMessages = loadLastProcessedMessages(AGENT_NAME);
  log(`Loaded last processed messages: ${Object.keys(lastMessages).length} channels`);
  
  // Check for missed messages in DMs first
  await checkDMChannels(readyClient, lastMessages);
  
  // Check bot-dms channel for relevant messages
  await checkBotDMsChannel(readyClient, lastMessages);
  
  if (DMS_ONLY) {
    log('DMs-only mode: finished checking DM channels, exiting');
    process.exit(0);
  }
  
  // Check for missed messages in guild channels
  await checkGuildChannels(readyClient, lastMessages);
  
  // Exit if in run-once mode after checking all channels
  if (RUN_ONCE) {
    log('Run-once mode: finished checking all channels, exiting');
    process.exit(0);
  }
  
  startupComplete = true;
  log('Bot initialization complete, monitoring for new messages...');
  if (HTTP_PORT) {
    log(`HTTP server available at http://localhost:${HTTP_PORT}/dms`);
  }
  
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

  if (message.author.bot) {
    handleLowPriorityMessage(message);
  } else {
    await handleRealtimeMessage(message);
  }
});

// Setup error handlers
setupErrorHandlers(client, log);

// Start HTTP server if configured
if (HTTP_PORT) {
  startHttpServer(client, HTTP_PORT, log);
}

// Load average monitoring
function checkLoadAverage() {
  try {
    const uptime = execSync('uptime').toString();
    const loadMatch = uptime.match(/load averages?: ([\d.]+)/);
    if (loadMatch) {
      const load = parseFloat(loadMatch[1]);
      if (load > MAX_LOAD_AVERAGE) {
        log(`HIGH LOAD DETECTED: ${load} - stopping new processes`);
        consecutiveFailures = MAX_FAILURES; // Trigger circuit breaker
      }
    }
  } catch (error) {
    log(`Load check failed: ${error.message}`);
  }
}

// Check load every 30 seconds
setInterval(checkLoadAverage, 30000);

client.login(DISCORD_TOKEN);
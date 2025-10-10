#!/usr/bin/env node

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { sendChannelMessage, sendWebhookMessage } from './lib/message-utils.js';

// Usage: node send-message.js <agent-name> <channel-id-or-name> "message text"
// Usage: node send-message.js <agent-name> dm <user-id> "message text"
// Usage: node send-message.js <agent-name> webhook <channel-id-or-name> "message text"

const agentName = process.argv[2];
const target = process.argv[3];
const userId = process.argv[4];
const messageText = process.argv[5];

if (!agentName || !target) {
  console.error('Usage: node send-message.js <agent-name> <channel-id-or-name> "message"');
  console.error('   OR: node send-message.js <agent-name> dm <user-id> "message"');
  console.error('   OR: node send-message.js <agent-name> webhook <channel-id-or-name> "message"');
  console.error('Examples:');
  console.error('  node send-message.js alex 1234567890 "Hello channel!"');
  console.error('  node send-message.js alex bot-testing "Hello channel!"');
  console.error('  node send-message.js brooke dm 9876543210 "Hello user!"');
  console.error('  node send-message.js alex webhook bot-testing "Hello via webhook!"');
  process.exit(1);
}

dotenv.config({ path: `.env.${agentName}`, quiet: true });

if (!process.env.DISCORD_TOKEN) {
  console.error(`Error: No DISCORD_TOKEN found in .env.${agentName}`);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages
  ]
});

async function resolveChannel(client, channelIdOrName) {
  // Try as ID first (if it's numeric)
  if (/^\d+$/.test(channelIdOrName)) {
    try {
      return await client.channels.fetch(channelIdOrName);
    } catch (error) {
      // Fall through to name search
    }
  }

  // Search by name (strip # prefix if present)
  const channelName = channelIdOrName.replace(/^#/, '');

  // Search in all guilds the bot is in
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find(ch => ch.name === channelName);
    if (channel) return channel;
  }

  throw new Error(`Channel not found: ${channelIdOrName}`);
}

client.once('clientReady', async () => {
  console.log(`Connected as ${client.user.tag}`);

  try {
    let targetChannel;
    let message;

    if (target === 'dm') {
      if (!userId || !messageText) {
        console.error('Error: DM requires user ID and message text');
        process.exit(1);
      }
      const user = await client.users.fetch(userId);
      targetChannel = await user.createDM();
      message = messageText;
      console.log(`Sending DM to ${user.username}...`);
    } else if (target === 'webhook') {
      if (!userId || !messageText) {
        console.error('Error: Webhook requires channel ID/name and message text');
        process.exit(1);
      }

      const webhookId = process.env.WEBHOOK_ID;
      const webhookToken = process.env.WEBHOOK_TOKEN;

      if (!webhookId || !webhookToken) {
        console.error('Error: WEBHOOK_ID and WEBHOOK_TOKEN required for webhook messages');
        process.exit(1);
      }

      const webhook = await client.fetchWebhook(webhookId, webhookToken);
      console.log(`Sending webhook message to channel...`);

      await sendWebhookMessage(webhook, messageText);

      console.log(`Webhook message sent successfully`);
      process.exit(0);
    } else {
      if (!userId) {
        console.error('Error: Channel message requires message text');
        process.exit(1);
      }
      targetChannel = await resolveChannel(client, target);
      message = userId; // In channel mode, userId is actually the message
      console.log(`Sending to channel ${targetChannel.name}...`);
    }
    
    // Send message to channel with ACL footer
    await sendChannelMessage(targetChannel, message);
    console.log(`Message sent successfully`);


  } catch (error) {
    console.error('Failed to send message:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
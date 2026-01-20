#!/usr/bin/env bun

import { Client, GatewayIntentBits, TextChannel, DMChannel, User } from 'discord.js';
import { getConfig } from '../lib/config.js';
import { sendChannelMessage, sendWebhookMessage } from '../lib/message-utils.js';

// Usage: ./send-message.ts <channel-id-or-name> "message text"
// Usage: ./send-message.ts dm <user-id> "message text"
// Usage: ./send-message.ts webhook <channel-id-or-name> "message text"
// Agent handle is read from ZDS_AI_AGENT_HANDLE environment variable

const agentHandle = process.env.ZDS_AI_AGENT_HANDLE;
const target = process.argv[2];
const userId = process.argv[3];
const messageText = process.argv[4];

if (!agentHandle) {
  console.error('Error: ZDS_AI_AGENT_HANDLE environment variable not set');
  process.exit(1);
}

if (!target) {
  console.error('Usage: ./send-message.ts <channel-id-or-name> "message"');
  console.error('   OR: ./send-message.ts dm <user-id> "message"');
  console.error('   OR: ./send-message.ts webhook <channel-id-or-name> "message"');
  console.error('Examples:');
  console.error('  ./send-message.ts 1234567890 "Hello channel!"');
  console.error('  ./send-message.ts bot-testing "Hello channel!"');
  console.error('  ./send-message.ts dm 9876543210 "Hello user!"');
  console.error('  ./send-message.ts webhook bot-testing "Hello via webhook!"');
  console.error('');
  console.error('Note: Agent handle is read from ZDS_AI_AGENT_HANDLE environment variable');
  process.exit(1);
}

// Load configuration
const config = getConfig(agentHandle);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages
  ]
});

async function resolveChannel(client: Client, channelIdOrName: string): Promise<TextChannel> {
  // Try as ID first (if it's numeric)
  if (/^\d+$/.test(channelIdOrName)) {
    try {
      const channel = await client.channels.fetch(channelIdOrName);
      if (channel && channel.isTextBased()) {
        return channel as TextChannel;
      }
    } catch (error) {
      // Fall through to name search
    }
  }

  // Search by name (strip # prefix if present)
  const channelName = channelIdOrName.replace(/^#/, '');

  // Search in all guilds the bot is in
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find(ch => ch.name === channelName);
    if (channel && channel.isTextBased()) {
      return channel as TextChannel;
    }
  }

  throw new Error(`Channel not found: ${channelIdOrName}`);
}

client.once('ready', async () => {
  console.log(`Connected as ${client.user?.tag}`);

  try {
    let targetChannel: TextChannel | DMChannel | undefined;
    let message: string | undefined;

    if (target === 'dm') {
      if (!userId || !messageText) {
        console.error('Error: DM requires user ID and message text');
        process.exit(1);
      }
      const user: User = await client.users.fetch(userId);
      const dmChannel = await user.createDM();
      targetChannel = dmChannel;
      message = messageText;
      console.log(`Sending DM to ${user.username}...`);
    } else if (target === 'webhook') {
      if (!userId || !messageText) {
        console.error('Error: Webhook requires channel ID/name and message text');
        process.exit(1);
      }

      const webhookId = config.discord.guild.ziquid.webhook.id;
      const webhookToken = config.discord.guild.ziquid.webhook.token;

      if (!webhookId || !webhookToken) {
        console.error('Error: Webhook ID and token required for webhook messages');
        process.exit(1);
      }

      const webhook = await client.fetchWebhook(webhookId, webhookToken);
      console.log(`Sending webhook message to channel...`);

      // Get bot's display name and avatar URL to show headshot
      const botUsername = client.user?.username || 'Bot';
      const botAvatarURL = client.user?.displayAvatarURL();

      await sendWebhookMessage(webhook, messageText, 1, botUsername, botAvatarURL);

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

    if (targetChannel && message) {
      // Send message to channel with ACL footer
      await sendChannelMessage(targetChannel, message, 1);
      console.log(`Message sent successfully`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send message:', errorMessage);
    process.exit(1);
  }

  process.exit(0);
});

client.login(config.discord.token);

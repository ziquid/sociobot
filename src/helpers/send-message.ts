#!/usr/bin/env bun

import { unlinkSync } from 'fs';
import { Client, GatewayIntentBits, TextChannel, User } from 'discord.js';
import { getConfig } from '../lib/config.js';
import { sendChannelMessage, sendWebhookMessage } from '../lib/message-utils.js';
import { resolveEmoji } from '../lib/emoji-map.js';
import { BOT_DMS_CHANNEL_ID } from '../lib/metadata.js';
import { encodeSpeech } from '../lib/qcli.js';

// Usage: sb-send-message [--encode] <channel-id-or-name> "message text"
// Usage: sb-send-message dm <user-id> "message text"
// Usage: sb-send-message webhook <channel-id-or-name> "message text"
// Usage: sb-send-message <channel-id-or-name> <message-id> "REACTION:<emoji>"
// Agent handle is read from ZDS_AI_AGENT_HANDLE environment variable

const agentHandle = process.env.ZDS_AI_AGENT_HANDLE;
const rawArgs = process.argv.slice(2);
const ENCODE_FLAG = rawArgs[0] === '--encode';
const args = ENCODE_FLAG ? rawArgs.slice(1) : rawArgs;
const target = args[0];
const userId = args[1];
const messageText = args[2];

if (!target || target === '-h' || target === '--help') {
  console.error('Usage: sb-send-message [--encode] <channel-id-or-name> "message"');
  console.error('   OR: sb-send-message dm <user-id> "message"');
  console.error('   OR: sb-send-message webhook <channel-id-or-name> "message"');
  console.error('   OR: sb-send-message <channel-id-or-name> <message-id> "REACTION:<emoji>"');
  console.error('');
  console.error('Examples:');
  console.error('  sb-send-message 1234567890 "Hello channel!"');
  console.error('  sb-send-message --encode bot-testing "Hello channel!"');
  console.error('  sb-send-message bot-testing "Hello channel!"');
  console.error('  sb-send-message dm 9876543210 "Hello user!"');
  console.error('  sb-send-message webhook bot-testing "Hello via webhook!"');
  console.error('  sb-send-message bot-testing 1234567890123456789 "REACTION:thumbsup"');
  console.error('  sb-send-message bot-testing 1234567890123456789 "REACTION:👍"');
  console.error('');
  console.error('Note: Agent handle is read from ZDS_AI_AGENT_HANDLE environment variable');
  process.exit(1);
}

if (!agentHandle) {
  console.error('Error: ZDS_AI_AGENT_HANDLE environment variable not set');
  process.exit(1);
}

const config = getConfig(agentHandle);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages
  ]
});

async function resolveChannel(client: Client, channelIdOrName: string): Promise<TextChannel> {
  if (/^\d+$/.test(channelIdOrName)) {
    try {
      const channel = await client.channels.fetch(channelIdOrName);
      if (channel && channel.isTextBased()) {
        return channel as TextChannel;
      }
    } catch (error) {
      // ignored — fall through to name search
    }
  }

  const channelName = channelIdOrName.replace(/^#/, '');

  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find(ch => ch.name === channelName);
    if (channel && channel.isTextBased()) {
      return channel as TextChannel;
    }
  }

  throw new Error(`Channel not found: ${channelIdOrName}`);
}

async function sendDM(): Promise<void> {
  if (!userId || !messageText) {
    console.error('Error: DM requires user ID and message text');
    process.exit(1);
  }
  const user: User = await client.users.fetch(userId);
  const dmChannel = await user.createDM();
  console.log(`Sending DM to ${user.username}...`);
  await sendChannelMessage(dmChannel, messageText, 1, true);
  console.log('Message sent successfully');
}

async function sendWebhook(): Promise<void> {
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
  console.log('Sending webhook message to channel...');
  const botUsername = client.user?.username || 'Bot';
  const botAvatarURL = client.user?.displayAvatarURL();
  await sendWebhookMessage(webhook, messageText, 1, botUsername, botAvatarURL, true);
  console.log('Webhook message sent successfully');
}

async function sendToChannel(): Promise<void> {
  if (!userId) {
    console.error('Error: Channel message requires message text');
    process.exit(1);
  }
  const channel = await resolveChannel(client, target);

  if (messageText?.startsWith('REACTION:')) {
    const messageId = userId;
    if (!/^\d+$/.test(messageId)) {
      console.error('Error: REACTION: requires a numeric message ID as the second argument');
      process.exit(1);
    }
    const emojiName = messageText.slice('REACTION:'.length).trim();
    if (!emojiName) {
      console.error('Error: REACTION: requires an emoji name or character (e.g. REACTION:thumbsup or REACTION:👍)');
      process.exit(1);
    }
    const emoji = resolveEmoji(client, emojiName);
    console.log(`Adding reaction to message ${messageId} in ${channel.name}...`);
    const targetMessage = await channel.messages.fetch(messageId);
    await targetMessage.react(emoji as any);
    console.log('Done');
    return;
  }

  const message = userId; // In channel mode, userId is actually the message
  console.log(`Sending to channel ${channel.name}...`);
  let audioPath: string | null = null;
  if (ENCODE_FLAG && channel.id !== BOT_DMS_CHANNEL_ID) {
    audioPath = encodeToAudio(message);
  }
  try {
    await sendChannelMessage(channel, message, 1, true, audioPath);
  } finally {
    if (audioPath) { try { unlinkSync(audioPath); } catch {} }
  }
  console.log('Message sent successfully');
}

function encodeToAudio(text: string): string | null {
  return encodeSpeech(text, agentHandle as string);
}

client.once('clientReady', async () => {
  console.log(`Connected as ${client.user?.tag}`);
  try {
    if (target === 'dm') await sendDM();
    else if (target === 'webhook') await sendWebhook();
    else await sendToChannel();
  } catch (error) {
    console.error('Failed to send message:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
  process.exit(0);
});

client.login(config.discord.token);

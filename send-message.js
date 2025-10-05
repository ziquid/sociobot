#!/usr/bin/env node

import { Client, GatewayIntentBits, ChannelType, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import { splitMessage } from './lib/message-utils.js';

// Usage: node send-message.js <agent-name> <channel-id> "message text"
// Usage: node send-message.js <agent-name> dm <user-id> "message text"
// Usage: node send-message.js <agent-name> webhook <channel-id> "message text"

const agentName = process.argv[2];
const target = process.argv[3];
const userId = process.argv[4];
const messageText = process.argv[5];

if (!agentName || !target) {
  console.error('Usage: node send-message.js <agent-name> <channel-id> "message"');
  console.error('   OR: node send-message.js <agent-name> dm <user-id> "message"');
  console.error('   OR: node send-message.js <agent-name> webhook <channel-id> "message"');
  console.error('Examples:');
  console.error('  node send-message.js alex 1234567890 "Hello channel!"');
  console.error('  node send-message.js brooke dm 9876543210 "Hello user!"');
  console.error('  node send-message.js alex webhook 1234567890 "Hello via webhook!"');
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
        console.error('Error: Webhook requires channel ID and message text');
        process.exit(1);
      }
      
      const webhookId = process.env.WEBHOOK_ID;
      const webhookToken = process.env.WEBHOOK_TOKEN;
      
      if (!webhookId || !webhookToken) {
        console.error('Error: WEBHOOK_ID and WEBHOOK_TOKEN required for webhook messages');
        process.exit(1);
      }
      
      const webhook = await client.fetchWebhook(webhookId, webhookToken);
      const chunks = splitMessage(messageText);
      
      console.log(`Sending webhook message to channel...`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length}) ` : '';
        await webhook.send(prefix + chunk);
      }
      
      console.log(`Webhook message sent successfully (${chunks.length} chunk${chunks.length > 1 ? 's' : ''})`);
      process.exit(0);
    } else {
      if (!userId) {
        console.error('Error: Channel message requires message text');
        process.exit(1);
      }
      targetChannel = await client.channels.fetch(target);
      message = userId; // In channel mode, userId is actually the message
      console.log(`Sending to channel ${targetChannel.name}...`);
    }
    
    // Add metadata using embed footer if alex sending to bot-testing
    if (agentName === 'alex' && targetChannel.name === 'bot-testing') {
      const embed = new EmbedBuilder()
        .setDescription(message)
        .setFooter({ text: `acl:1 • Sent by a ZDS AI Agent • zds-agents.com` });

      await targetChannel.send({ embeds: [embed] });
      console.log(`Message sent successfully`);
    } else {
      const chunks = splitMessage(message);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length}) ` : '';
        await targetChannel.send(prefix + chunk);
      }

      console.log(`Message sent successfully (${chunks.length} chunk${chunks.length > 1 ? 's' : ''})`);
    }

  } catch (error) {
    console.error('Failed to send message:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
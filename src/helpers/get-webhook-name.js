#!/usr/bin/env node

/**
 * Get Discord webhook name for verification
 */

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

async function getWebhookName(botName) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    // Load bot's environment
    dotenv.config({ path: `.env.${botName}` });

    if (!process.env.DISCORD_TOKEN || !process.env.WEBHOOK_ID) {
      throw new Error('DISCORD_TOKEN or WEBHOOK_ID not found in env file');
    }

    await client.login(process.env.DISCORD_TOKEN);
    const webhook = await client.fetchWebhook(process.env.WEBHOOK_ID);
    console.log(webhook.name);

  } catch (error) {
    console.error('❌ Failed to get webhook name:', error.message);
    process.exit(1);
  } finally {
    await client.destroy();
  }
}

const botName = process.argv[2];
if (!botName) {
  console.error('Usage: node get-webhook-name.js <bot-name>');
  console.error('Example: node get-webhook-name.js <bot-name>');
  process.exit(1);
}

getWebhookName(botName);
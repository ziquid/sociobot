#!/usr/bin/env bun

/**
 * Get Discord webhook name for verification
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { getConfig } from '../lib/config.js';

async function getWebhookName(botName) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    // Load configuration
    const config = getConfig(botName);

    await client.login(config.discord.token);
    const webhook = await client.fetchWebhook(config.discord.guild.ziquid.webhook.id);
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
  console.error('Usage: ./get-webhook-name.js <bot-name>');
  console.error('Example: ./get-webhook-name.js <bot-name>');
  process.exit(1);
}

getWebhookName(botName);
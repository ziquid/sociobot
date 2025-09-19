#!/usr/bin/env node

/**
 * Get Discord bot application name for verification
 */

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

async function getBotName(botName) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    // Load bot's environment
    dotenv.config({ path: `.env.${botName}` });

    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN not found in env file');
    }

    await client.login(process.env.DISCORD_TOKEN);
    const app = await client.application.fetch();
    console.log(app.name);

  } catch (error) {
    console.error('❌ Failed to get bot name:', error.message);
    process.exit(1);
  } finally {
    await client.destroy();
  }
}

const botName = process.argv[2];
if (!botName) {
  console.error('Usage: node get-bot-name.js <bot-name>');
  console.error('Example: node get-bot-name.js <bot-name>');
  process.exit(1);
}

getBotName(botName);
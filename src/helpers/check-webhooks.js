#!/usr/bin/env node

/**
 * Check existing webhook names and properties
 */

import { Client, GatewayIntentBits } from 'discord.js';
import fs from 'fs';

async function checkWebhooks(channelId) {
  console.log('🔍 Checking existing webhooks...');
  
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  
  try {
    // Load admin bot's token
    const adminEnv = fs.readFileSync('.env.admin-agent', 'utf8');
    const tokenMatch = adminEnv.match(/DISCORD_TOKEN=(.+)/);
    
    await client.login(tokenMatch[1]);
    console.log('✅ Connected to Discord');
    
    const channel = await client.channels.fetch(channelId);
    const webhooks = await channel.fetchWebhooks();
    
    console.log(`\n📋 Found ${webhooks.size} webhooks in #${channel.name}:`);
    
    webhooks.forEach(webhook => {
      console.log(`\n🔗 Webhook: ${webhook.name}`);
      console.log(`   ID: ${webhook.id}`);
      console.log(`   Token: ${webhook.token?.substring(0, 20)}...`);
      console.log(`   Avatar: ${webhook.avatar || 'none'}`);
      console.log(`   Created: ${webhook.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to check webhooks:', error.message);
  } finally {
    await client.destroy();
  }
}

const channelId = process.argv[2] || '1417639609231347812';
checkWebhooks(channelId);

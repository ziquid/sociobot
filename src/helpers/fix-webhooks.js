#!/usr/bin/env node

/**
 * Webhook Diagnostic and Fix Script
 * Checks current webhook names and recreates with proper individual identities
 */

import { Client, GatewayIntentBits } from 'discord.js';
import fs from 'fs';

const BOTS = [
  { name: 'test-agent', displayName: 'Test Agent', webhookName: 'Test Agent' }
];

async function fixWebhooks(channelId) {
  console.log('🔍 Diagnosing webhook issues...');
  
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  
  try {
    // Load admin bot's token
    const adminEnv = fs.readFileSync('.env.admin-agent', 'utf8');
    const tokenMatch = adminEnv.match(/DISCORD_TOKEN=(.+)/);
    await client.login(tokenMatch[1]);
    
    const channel = await client.channels.fetch(channelId);
    console.log(`📢 Checking webhooks in channel: ${channel.name}`);
    
    // Get existing webhooks
    const webhooks = await channel.fetchWebhooks();
    console.log(`\n📋 Found ${webhooks.size} existing webhooks:`);
    
    webhooks.forEach(webhook => {
      console.log(`  - ${webhook.name} (ID: ${webhook.id})`);
    });
    
    // Delete old webhooks
    console.log('\n🗑️ Deleting old webhooks...');
    for (const webhook of webhooks.values()) {
      await webhook.delete('Cleaning up for proper bot identity separation');
      console.log(`  ✅ Deleted: ${webhook.name}`);
    }
    
    // Create new webhooks with proper names
    console.log('\n🔧 Creating new webhooks with proper names...');
    const webhookResults = [];
    
    for (const bot of BOTS) {
      const webhook = await channel.createWebhook({
        name: bot.webhookName,
        reason: `Individual webhook for ${bot.name} bot with proper identity`
      });
      
      const result = {
        botName: bot.name,
        webhookId: webhook.id,
        webhookToken: webhook.token,
        webhookName: webhook.name
      };
      
      webhookResults.push(result);
      console.log(`  ✅ Created: ${webhook.name} (ID: ${webhook.id})`);
      
      // Update .env file
      await updateEnvFile(bot.name, result);
    }
    
    console.log('\n🎉 Webhook fix complete!');
    console.log('Each bot now has a unique webhook name and identity.');
    
  } catch (error) {
    console.error('❌ Webhook fix failed:', error.message);
  } finally {
    await client.destroy();
  }
}

async function updateEnvFile(botName, webhookData) {
  const envPath = `.env.${botName}`;
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  envContent = envContent.replace(/WEBHOOK_ID=.+/, `WEBHOOK_ID=${webhookData.webhookId}`);
  envContent = envContent.replace(/WEBHOOK_TOKEN=.+/, `WEBHOOK_TOKEN=${webhookData.webhookToken}`);
  
  fs.writeFileSync(envPath, envContent);
  console.log(`    📝 Updated ${envPath}`);
}

// Run the fix
fixWebhooks('1417639609231347812');

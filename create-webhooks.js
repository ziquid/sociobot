#!/usr/bin/env node

/**
 * Discord Webhook Creator for ZDS Bot Infrastructure
 * 
 * Purpose: Creates unique webhooks for each bot to prevent message cross-contamination
 * Author: Alex Chen, Senior DevOps Engineer
 * Date: 2025-09-16
 * 
 * PROBLEM SOLVED:
 * - All bots were sharing the same webhook (Devon's legacy webhook)
 * - This caused identity confusion and message routing issues
 * - Each bot needs its own webhook for proper isolation
 * 
 * USAGE:
 *   node create-webhooks.js <channel-id>
 * 
 * EXAMPLE:
 *   node create-webhooks.js 1417639609231347812
 * 
 * REQUIREMENTS:
 * - Discord bot token with webhook creation permissions
 * - Channel ID where webhooks should be created
 * - Write access to .env files for updating credentials
 */

import { Client, GatewayIntentBits } from 'discord.js';
import fs from 'fs';
import path from 'path';

// Bot configurations
const BOTS = [
  { name: 'alex', displayName: 'Alex Chen (DevOps)' },
  { name: 'brooke', displayName: 'Brooke (Finance)' },
  { name: 'harriet', displayName: 'Harriet (HR)' }
];

async function createWebhooks(channelId) {
  console.log('🔧 Discord Webhook Creator Starting...');
  console.log(`📍 Target Channel ID: ${channelId}`);
  
  // Use Alex's token for webhook creation (admin privileges)
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  
  try {
    // Load Alex's token for webhook creation
    const alexEnv = fs.readFileSync('.env.alex', 'utf8');
    const tokenMatch = alexEnv.match(/DISCORD_TOKEN=(.+)/);
    if (!tokenMatch) {
      throw new Error('Could not find DISCORD_TOKEN in .env.alex');
    }
    
    await client.login(tokenMatch[1]);
    console.log('✅ Connected to Discord');
    
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    
    console.log(`📢 Creating webhooks in channel: ${channel.name}`);
    
    const webhookResults = [];
    
    for (const bot of BOTS) {
      console.log(`\n🤖 Creating webhook for ${bot.name}...`);
      
      try {
        const webhook = await channel.createWebhook({
          name: bot.displayName,
          reason: `Webhook for ${bot.name} bot - created by Alex Chen webhook automation`
        });
        
        const result = {
          botName: bot.name,
          webhookId: webhook.id,
          webhookToken: webhook.token,
          webhookUrl: webhook.url
        };
        
        webhookResults.push(result);
        
        console.log(`✅ ${bot.name} webhook created:`);
        console.log(`   ID: ${webhook.id}`);
        console.log(`   Token: ${webhook.token.substring(0, 20)}...`);
        
        // Update the bot's .env file
        await updateEnvFile(bot.name, result);
        
      } catch (error) {
        console.error(`❌ Failed to create webhook for ${bot.name}:`, error.message);
      }
    }
    
    // Create documentation
    await createWebhookDocumentation(webhookResults, channelId);
    
    console.log('\n🎉 Webhook creation complete!');
    console.log('📋 Documentation saved to WEBHOOKS.md');
    console.log('⚠️  Remember to restart all bots to use new webhooks');
    
  } catch (error) {
    console.error('❌ Webhook creation failed:', error.message);
    process.exit(1);
  } finally {
    await client.destroy();
  }
}

async function updateEnvFile(botName, webhookData) {
  const envPath = `.env.${botName}`;
  
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update webhook ID and token
    envContent = envContent.replace(/WEBHOOK_ID=.+/, `WEBHOOK_ID=${webhookData.webhookId}`);
    envContent = envContent.replace(/WEBHOOK_TOKEN=.+/, `WEBHOOK_TOKEN=${webhookData.webhookToken}`);
    
    fs.writeFileSync(envPath, envContent);
    console.log(`   📝 Updated ${envPath}`);
    
  } catch (error) {
    console.error(`   ❌ Failed to update ${envPath}:`, error.message);
  }
}

async function createWebhookDocumentation(webhookResults, channelId) {
  const timestamp = new Date().toISOString();
  
  const documentation = `# Discord Webhook Documentation

**Created:** ${timestamp}  
**Created By:** Alex Chen, Senior DevOps Engineer  
**Channel ID:** ${channelId}  
**Purpose:** Individual webhooks for each ZDS bot to prevent message cross-contamination

## Problem Solved

Previously, all bots shared the same webhook credentials (Devon's legacy webhook), causing:
- Identity confusion between bots
- Message routing issues  
- Inability for bots to communicate with each other properly

## Solution

Each bot now has its own dedicated webhook for proper message isolation.

## Webhook Inventory

${webhookResults.map(webhook => `
### ${webhook.botName.toUpperCase()} Bot
- **Webhook ID:** \`${webhook.webhookId}\`
- **Webhook Token:** \`${webhook.webhookToken}\`
- **Webhook URL:** \`${webhook.webhookUrl}\`
- **Config File:** \`.env.${webhook.botName}\`
`).join('\n')}

## Maintenance Instructions

### To Recreate Webhooks:
\`\`\`bash
node create-webhooks.js <channel-id>
\`\`\`

### To Restart Bots After Webhook Changes:
\`\`\`bash
./botctl restart
\`\`\`

### To Verify Webhook Configuration:
\`\`\`bash
# Check each bot's .env file
cat .env.alex | grep WEBHOOK
cat .env.brooke | grep WEBHOOK  
cat .env.harriet | grep WEBHOOK
\`\`\`

## Security Notes

- Webhook tokens are sensitive credentials - treat like passwords
- Each bot's .env file contains its unique webhook credentials
- Never share webhook tokens in logs or documentation
- Rotate webhooks if compromised

## Troubleshooting

### Bot Identity Confusion:
1. Verify each bot has unique WEBHOOK_ID and WEBHOOK_TOKEN
2. Restart all bots after credential changes
3. Check botctl logs for startup errors

### Message Routing Issues:
1. Confirm webhooks are created in correct channel
2. Verify bot permissions in target channel
3. Check Discord API rate limits

---
*This documentation was auto-generated by create-webhooks.js*
*Keep this file updated when making webhook changes*
`;

  fs.writeFileSync('WEBHOOKS.md', documentation);
}

// Main execution
if (process.argv.length < 3) {
  console.error('Usage: node create-webhooks.js <channel-id>');
  console.error('Example: node create-webhooks.js 1417639609231347812');
  process.exit(1);
}

const channelId = process.argv[2];
createWebhooks(channelId);

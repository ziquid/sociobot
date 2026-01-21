#!/usr/bin/env bun

/**
 * Discord Webhook Creator for ZDS Bot Infrastructure
 *
 * Purpose: Creates unique webhooks for each bot to prevent message cross-contamination
 * Author: ZDS AI Team
 * Date: 2025-09-16
 * Updated: 2026-01-21 - Converted to TypeScript
 *
 * PROBLEM SOLVED:
 * - All bots were sharing the same webhook (legacy shared webhook)
 * - This caused identity confusion and message routing issues
 * - Each bot needs its own webhook for proper isolation
 *
 * USAGE:
 *   ./create-webhooks.ts <channel-id>
 *
 * EXAMPLE:
 *   ./create-webhooks.ts 1417639609231347812
 *
 * REQUIREMENTS:
 * - Discord bot token with webhook creation permissions
 * - Channel ID where webhooks should be created
 * - Write access to .env files for updating credentials
 */

import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

interface BotConfig {
  name: string;
  displayName: string;
}

interface WebhookResult {
  botName: string;
  webhookId: string;
  webhookToken: string;
  webhookUrl: string;
}

// Bot configurations
const BOTS: BotConfig[] = [
  { name: 'test-agent', displayName: 'Test Agent' }
];

async function createWebhooks(channelId: string, targetBot?: string): Promise<void> {
  console.log('Discord Webhook Creator Starting...');
  console.log(`Target Channel ID: ${channelId}`);

  // Filter bots if specific bot requested
  let botsToCreate = BOTS;
  if (targetBot) {
    botsToCreate = BOTS.filter(bot => bot.name === targetBot);
    if (botsToCreate.length === 0) {
      console.error(`Bot '${targetBot}' not found. Available bots: ${BOTS.map(b => b.name).join(', ')}`);
      process.exit(1);
    }
    console.log(`Creating webhook only for: ${targetBot}`);
  } else {
    console.log(`Creating webhooks for all bots`);
  }

  // Use admin bot's token for webhook creation (admin privileges)
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    // Load admin bot's token for webhook creation
    const adminHomeDir = process.env.ZDS_AI_AGENT_HOME_DIR ||
                         execSync(`echo ~admin-agent`).toString().trim();
    const adminEnvPath = `${adminHomeDir}/.env`;

    if (!existsSync(adminEnvPath)) {
      throw new Error(`Admin environment file not found: ${adminEnvPath}`);
    }

    const adminEnv = readFileSync(adminEnvPath, 'utf8');
    const tokenMatch = adminEnv.match(/DISCORD_TOKEN=(.+)/);
    if (!tokenMatch) {
      throw new Error(`Could not find DISCORD_TOKEN in ${adminEnvPath}`);
    }

    await client.login(tokenMatch[1]);
    console.log('Connected to Discord');

    const channel = await client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} not found`);
    }

    console.log(`Creating webhooks in channel: ${channel.name}`);

    const webhookResults: WebhookResult[] = [];

    for (const bot of botsToCreate) {
      console.log(`\nCreating webhook for ${bot.name}...`);

      try {
        const webhook = await channel.createWebhook({
          name: bot.displayName,
          reason: `Webhook for ${bot.name} bot`
        });

        const result: WebhookResult = {
          botName: bot.name,
          webhookId: webhook.id,
          webhookToken: webhook.token!,
          webhookUrl: webhook.url
        };

        webhookResults.push(result);

        console.log(`${bot.name} webhook created:`);
        console.log(`   ID: ${webhook.id}`);
        console.log(`   Token: ${webhook.token!.substring(0, 20)}...`);

        // Update the bot's .env file
        await updateEnvFile(bot.name, result);

      } catch (error) {
        console.error(`Failed to create webhook for ${bot.name}:`, (error as Error).message);
      }
    }

    // Create documentation
    await createWebhookDocumentation(webhookResults, channelId);

    console.log('\nWebhook creation complete!');
    console.log('Documentation saved to WEBHOOKS.md');
    console.log('Remember to restart all bots to use new webhooks');

  } catch (error) {
    console.error('Webhook creation failed:', (error as Error).message);
    process.exit(1);
  } finally {
    await client.destroy();
  }
}

async function updateEnvFile(botName: string, webhookData: WebhookResult): Promise<void> {
  // Resolve agent home directory
  const homeDir = process.env.ZDS_AI_AGENT_HOME_DIR ||
                  execSync(`echo ~${botName}`).toString().trim();
  const envPath = `${homeDir}/.env`;

  try {
    if (!existsSync(envPath)) {
      throw new Error(`Environment file not found: ${envPath}`);
    }

    let envContent = readFileSync(envPath, 'utf8');

    // Update webhook ID and token
    envContent = envContent.replace(/WEBHOOK_ID=.*/, `WEBHOOK_ID=${webhookData.webhookId}`);
    envContent = envContent.replace(/WEBHOOK_TOKEN=.*/, `WEBHOOK_TOKEN=${webhookData.webhookToken}`);

    writeFileSync(envPath, envContent);
    console.log(`   Updated ${envPath}`);

  } catch (error) {
    console.error(`   Failed to update ${envPath}:`, (error as Error).message);
  }
}

async function createWebhookDocumentation(webhookResults: WebhookResult[], channelId: string): Promise<void> {
  const timestamp = new Date().toISOString();

  const documentation = `# Discord Webhook Documentation

**Created:** ${timestamp}
**Created By:** ZDS AI Team
**Channel ID:** ${channelId}
**Purpose:** Individual webhooks for each bot to prevent message cross-contamination

## Problem Solved

Previously, all bots shared the same webhook credentials (legacy shared webhook), causing:
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
./create-webhooks.ts <channel-id>
\`\`\`

### To Restart Bots After Webhook Changes:
\`\`\`bash
./botctl restart
\`\`\`

### To Verify Webhook Configuration:
\`\`\`bash
# Check each bot's .env file
cat .env.test-agent | grep WEBHOOK
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
*This documentation was auto-generated by create-webhooks.ts*
*Keep this file updated when making webhook changes*
`;

  writeFileSync('WEBHOOKS.md', documentation);
}

// Main execution
if (process.argv.length < 3) {
  console.error('Usage: ./create-webhooks.ts <channel-id> [bot-name]');
  console.error('Example: ./create-webhooks.ts 1417639609231347812');
  console.error('Example: ./create-webhooks.ts 1417639609231347812 test-agent');
  process.exit(1);
}

const channelId = process.argv[2];
const targetBot = process.argv[3]; // Optional bot name
createWebhooks(channelId, targetBot);

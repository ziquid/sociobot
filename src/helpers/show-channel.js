#!/usr/bin/env bun

import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { Client, GatewayIntentBits, ChannelType } from "discord.js";

const agentName = process.argv[2];
const channelId = process.argv[3];

if (!agentName || !channelId) {
  console.error('Usage: ./show-channel.js <agent-name> <channel-id>');
  process.exit(1);
}

// Resolve agent home directory
const homeDir = process.env.ZDS_AI_AGENT_HOME_DIR ||
                execSync(`echo ~${agentName}`).toString().trim();
const envPath = `${homeDir}/.env`;

if (!existsSync(envPath)) {
  console.error(`Error: Environment file not found: ${envPath}`);
  process.exit(1);
}

process.env.DOTENV_CONFIG_QUIET = 'true';
dotenv.config({ path: envPath, quiet: true });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages],
});

client.once('clientReady', async () => {
  try {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.log(`Channel ${channelId} not found`);
      process.exit(1);
    }
    
    console.log(`Channel ${channelId}:`);
    console.log(`  Type: ${ChannelType[channel.type]} (${channel.type})`);
    console.log(`  Name: ${channel.name || 'N/A'}`);
    console.log(`  Slowdown: ${channel.rateLimitPerUser || 0} seconds`);
    
    if (channel.type === ChannelType.DM) {
      console.log(`  Recipient: ${channel.recipient?.username} (${channel.recipient?.id})`);
    } else if (channel.guild) {
      console.log(`  Guild: ${channel.guild.name} (${channel.guild.id})`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
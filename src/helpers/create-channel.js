#!/usr/bin/env bun

import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const channelName = process.argv[2];
const isPrivate = process.argv[3] === '--private';
const botName = process.argv[4] || 'test-agent';

if (!channelName) {
  console.error('Usage: ./create-channel.js <channel-name> [--private] [bot-name]');
  console.error('Example: ./create-channel.js proj-ticketing --private test-agent');
  process.exit(1);
}

// Resolve agent home directory
const homeDir = process.env.ZDS_AI_AGENT_HOME_DIR ||
                execSync(`echo ~${botName}`).toString().trim();
const envPath = `${homeDir}/.env`;

if (!existsSync(envPath)) {
  console.error(`Error: Environment file not found: ${envPath}`);
  process.exit(1);
}

process.env.DOTENV_CONFIG_QUIET = 'true';
dotenv.config({ path: envPath, quiet: true });

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`Connected as ${client.user.tag}`);
  
  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error('No guild found');
    process.exit(1);
  }
  
  console.log(`Creating channel: ${channelName} in guild: ${guild.name}`);
  console.log(`Private: ${isPrivate}`);
  
  try {
    const channelOptions = {
      name: channelName,
      type: ChannelType.GuildText,
    };
    
    if (isPrivate) {
      channelOptions.permissionOverwrites = [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        }
      ];
    }
    
    const channel = await guild.channels.create(channelOptions);
    console.log('✅ Created channel:', channel.name);
    console.log('   ID:', channel.id);
    console.log('   Type:', channel.type);
    console.log('   Private:', isPrivate);
  } catch (error) {
    console.error('❌ Error creating channel:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);

#!/usr/bin/env node

import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';

const channelName = process.argv[2];
const isPrivate = process.argv[3] === '--private';
const botName = process.argv[4] || 'devon';

if (!channelName) {
  console.error('Usage: node create-channel.js <channel-name> [--private] [bot-name]');
  console.error('Example: node create-channel.js proj-ticketing --private devon');
  process.exit(1);
}

dotenv.config({ path: `.env.${botName}` });

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

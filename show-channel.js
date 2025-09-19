#!/usr/bin/env node

import dotenv from 'dotenv';
import { Client, GatewayIntentBits, ChannelType } from "discord.js";

const agentName = process.argv[2];
const channelId = process.argv[3];

if (!agentName || !channelId) {
  console.error('Usage: node show-channel.js <agent-name> <channel-id>');
  process.exit(1);
}

dotenv.config({ path: `.env.${agentName}`, quiet: true });

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
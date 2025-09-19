#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.devon' });

import { Client, Events, GatewayIntentBits, ChannelType, Partials } from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot ready! Logged in as ${readyClient.user.tag}`);
  
  const dmChannels = readyClient.channels.cache.filter(c => c.type === ChannelType.DM);
  console.log(`DM channels in cache: ${dmChannels.size}`);
  
  if (dmChannels.size > 0) {
    console.log('DM channels found:');
    for (const [id, channel] of dmChannels) {
      console.log(`  ${id}: ${channel.recipient?.username}`);
    }
  } else {
    console.log('No DM channels found in cache');
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
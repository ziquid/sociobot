#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.devon' });

import { Client, Events, GatewayIntentBits, ChannelType, Partials } from "discord.js";
import { startHttpServer } from "./lib/http-server.js";

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
  console.log(`DM channels in cache: ${readyClient.channels.cache.filter(c => c.type === ChannelType.DM).size}`);
  
  startHttpServer(client, 3001, console.log);
  console.log('HTTP server started on port 3001');
  console.log('Visit http://localhost:3001/dms to check DMs');
});

client.login(process.env.DISCORD_TOKEN);
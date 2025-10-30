#!/usr/bin/env node

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.alex' });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  try {
    const guilds = await client.guilds.fetch();
    console.log(`Found ${guilds.size} guilds`);
    
    for (const [guildId, guild] of guilds) {
      const fullGuild = await client.guilds.fetch(guildId);
      console.log(`\nGuild: ${fullGuild.name} (${guildId})`);
      console.log(`Member count: ${fullGuild.memberCount}`);
      console.log(`Cached members: ${fullGuild.members.cache.size}`);
      
      console.log('Starting member fetch...');
      const startTime = Date.now();
      
      try {
        const members = await fullGuild.members.fetch();
        const elapsed = Date.now() - startTime;
        console.log(`✓ Fetched ${members.size} members in ${elapsed}ms`);
        console.log(`Members: ${Array.from(members.values()).map(m => m.user.username).join(', ')}`);
      } catch (error) {
        const elapsed = Date.now() - startTime;
        console.log(`✗ Failed after ${elapsed}ms: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);

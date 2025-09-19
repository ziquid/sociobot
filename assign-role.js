#!/usr/bin/env node

import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from "discord.js";
import fs from 'fs';

const roleName = process.argv[2];
const targetAgent = process.argv[3];
const adminAgent = process.argv[4];

if (!roleName || !targetAgent || !adminAgent) {
  console.error('Usage: node assign-role.js <role-name> <target-agent> <admin-agent>');
  console.error('Example: node assign-role.js "ZDS Bots" "brooke" "alex"');
  process.exit(1);
}

// Load target bot's user ID
let targetBotUserId;
try {
  const targetEnv = fs.readFileSync(`.env.${targetAgent}`, 'utf8');
  const match = targetEnv.match(/BOT_USER_ID=(.+)/);
  if (!match) {
    console.error(`Error: BOT_USER_ID not found in .env.${targetAgent}`);
    process.exit(1);
  }
  targetBotUserId = match[1].trim();
} catch (error) {
  console.error(`Error: Could not read .env.${targetAgent}`);
  process.exit(1);
}

// Load admin credentials
dotenv.config({ path: `.env.${adminAgent}` });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error(`Error: DISCORD_TOKEN not found in .env.${adminAgent}`);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
});

client.once('clientReady', async (readyClient) => {
  console.log(`Connected as ${readyClient.user.tag}`);
  console.log(`Assigning role "${roleName}" to bot ${targetAgent} (${targetBotUserId})\n`);
  
  const guilds = readyClient.guilds.cache;
  
  for (const [guildId, guild] of guilds) {
    console.log(`Server: ${guild.name}`);
    
    try {
      // Find the role
      const role = guild.roles.cache.find(r => r.name === roleName);
      if (!role) {
        console.log(`❌ Role "${roleName}" not found`);
        continue;
      }
      
      console.log(`✅ Found role: ${role.name} (${role.id})`);
      
      // Get target bot member by user ID
      try {
        const targetMember = await guild.members.fetch(targetBotUserId);
        await targetMember.roles.add(role);
        console.log(`  ✅ Assigned role to ${targetMember.displayName} (${targetBotUserId})`);
      } catch (error) {
        console.log(`  ❌ Failed to assign role to ${targetAgent}: ${error.message}`);
      }
      
    } catch (error) {
      console.log(`❌ Failed to assign role: ${error.message}`);
    }
    
    console.log();
  }
  
  process.exit(0);
});

client.login(DISCORD_TOKEN);
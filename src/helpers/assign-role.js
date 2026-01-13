#!/usr/bin/env bun

import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { Client, GatewayIntentBits } from "discord.js";

const roleName = process.argv[2];
const targetAgent = process.argv[3];
const adminAgent = process.argv[4];

if (!roleName || !targetAgent || !adminAgent) {
  console.error('Usage: ./assign-role.js <role-name> <target-agent> <admin-agent>');
  console.error('Example: ./assign-role.js "Bot Role" "test-agent" "admin-agent"');
  process.exit(1);
}

// Load target bot's user ID
let targetBotUserId;
try {
  // Resolve target agent home directory
  const targetHomeDir = process.env.ZDS_AI_AGENT_HOME_DIR ||
                        execSync(`echo ~${targetAgent}`).toString().trim();
  const targetEnvPath = `${targetHomeDir}/.env`;

  if (!existsSync(targetEnvPath)) {
    console.error(`Error: Environment file not found: ${targetEnvPath}`);
    process.exit(1);
  }

  const targetEnv = readFileSync(targetEnvPath, 'utf8');
  const match = targetEnv.match(/BOT_USER_ID=(.+)/);
  if (!match) {
    console.error(`Error: BOT_USER_ID not found in ${targetEnvPath}`);
    process.exit(1);
  }
  targetBotUserId = match[1].trim();
} catch (error) {
  console.error(`Error: Could not read target agent env file:`, error.message);
  process.exit(1);
}

// Load admin credentials
// Resolve admin agent home directory
const adminHomeDir = process.env.ZDS_AI_AGENT_HOME_DIR ||
                     execSync(`echo ~${adminAgent}`).toString().trim();
const adminEnvPath = `${adminHomeDir}/.env`;

if (!existsSync(adminEnvPath)) {
  console.error(`Error: Environment file not found: ${adminEnvPath}`);
  process.exit(1);
}

process.env.DOTENV_CONFIG_QUIET = 'true';
dotenv.config({ path: adminEnvPath, quiet: true });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error(`Error: DISCORD_TOKEN not found in ${adminEnvPath}`);
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
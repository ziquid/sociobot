#!/usr/bin/env bun

import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { Client, GatewayIntentBits } from "discord.js";

const agentName = process.argv[2];

if (!agentName) {
  console.error('Usage: ./list-roles.js <agent-name>');
  console.error('Example: ./list-roles.js test-agent');
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

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error(`Error: DISCORD_TOKEN not found in ${envPath}`);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
});

client.once('clientReady', async (readyClient) => {
  console.log(`Bot logged in as ${readyClient.user.tag}`);
  console.log("\n=== BOT ROLES ===\n");
  
  const guilds = readyClient.guilds.cache;
  for (const [guildId, guild] of guilds) {
    console.log(`Server: ${guild.name} (${guildId})`);
    
    try {
      const botMember = await guild.members.fetch(readyClient.user.id);
      const roles = botMember.roles.cache;
      
      console.log(`  Bot Member: ${botMember.displayName}`);
      console.log(`  Roles (${roles.size}):`);
      
      for (const [roleId, role] of roles) {
        if (role.name !== '@everyone') {
          console.log(`    ${role.name} (${roleId}) - Color: ${role.hexColor}`);
        }
      }
      
      console.log(`  Permissions:`);
      const permissions = botMember.permissions.toArray();
      permissions.forEach(perm => {
        console.log(`    ${perm}`);
      });
      
    } catch (error) {
      console.log(`  Error fetching bot member: ${error.message}`);
    }
    
    console.log();
  }
  
  process.exit(0);
});

client.login(DISCORD_TOKEN);
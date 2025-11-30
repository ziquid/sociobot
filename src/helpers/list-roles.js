#!/usr/bin/env node

import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from "discord.js";

const agentName = process.argv[2];

if (!agentName) {
  console.error('Usage: node list-roles.js <agent-name>');
  console.error('Example: node list-roles.js test-agent');
  process.exit(1);
}

dotenv.config({ path: `.env.${agentName}` });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error(`Error: DISCORD_TOKEN not found in .env.${agentName}`);
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
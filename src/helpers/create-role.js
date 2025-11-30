#!/usr/bin/env node

import dotenv from 'dotenv';
import { Client, GatewayIntentBits, PermissionsBitField } from "discord.js";

const roleName = process.argv[2];
const agentName = process.argv[3];

if (!roleName || !agentName) {
  console.error('Usage: node create-role.js <role-name> <admin-agent>');
  console.error('Example: node create-role.js "Bot Role" "test-agent"');
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
  console.log(`Connected as ${readyClient.user.tag}`);
  console.log(`Creating role: ${roleName}\n`);
  
  const guilds = readyClient.guilds.cache;
  
  for (const [guildId, guild] of guilds) {
    console.log(`Server: ${guild.name}`);
    
    try {
      // Create the role
      const role = await guild.roles.create({
        name: roleName,
        color: '#5865F2', // Discord blurple
        permissions: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AddReactions,
          PermissionsBitField.Flags.UseExternalEmojis,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.ManageWebhooks,
          PermissionsBitField.Flags.UseApplicationCommands
        ],
        reason: `Created by ${agentName} for ZDS bot management`
      });
      
      console.log(`✅ Created role: ${role.name} (${role.id})`);
      console.log(`Use: node assign-role.js "${role.name}" all`);
      
    } catch (error) {
      console.log(`❌ Failed to create role: ${error.message}`);
    }
    
    console.log();
  }
  
  process.exit(0);
});

client.login(DISCORD_TOKEN);
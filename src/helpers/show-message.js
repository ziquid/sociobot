#!/usr/bin/env node

import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from "discord.js";

const agentName = process.argv[2];
const messageId = process.argv[3];

if (!agentName || !messageId) {
  console.error('Usage: node show-message.js <agent-name> <message-id>');
  process.exit(1);
}

dotenv.config({ path: `.env.${agentName}`, quiet: true });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages],
});

client.once('clientReady', async () => {
  try {
    // Try to find the message in all accessible channels
    const guilds = await client.guilds.fetch();
    let found = false;
    
    // Check DM channels first
    for (const [channelId, channel] of client.channels.cache) {
      if (channel.isTextBased()) {
        try {
          const message = await channel.messages.fetch(messageId);
          console.log(`Found message ${messageId} in ${channel.name || `DM with ${channel.recipient?.username}`}:`);
          console.log(`  Author: ${message.author.username} (bot: ${message.author.bot})`);
          console.log(`  Created: ${message.createdAt.toLocaleString()}`);
          console.log(`  Content: ${message.content}`);
          found = true;
          break;
        } catch (error) {
          // Message not in this channel, continue
        }
      }
    }
    
    if (!found) {
      // Check guild channels
      for (const [guildId, guild] of guilds) {
        const fullGuild = await client.guilds.fetch(guildId);
        const channels = await fullGuild.channels.fetch();
        
        for (const [channelId, channel] of channels) {
          if (channel.isTextBased()) {
            try {
              const message = await channel.messages.fetch(messageId);
              console.log(`Found message ${messageId} in ${fullGuild.name}/#${channel.name}:`);
              console.log(`  Author: ${message.author.username} (bot: ${message.author.bot})`);
              console.log(`  Created: ${message.createdAt.toLocaleString()}`);
              console.log(`  Content: ${message.content}`);
              found = true;
              break;
            } catch (error) {
              // Message not in this channel, continue
            }
          }
        }
        if (found) break;
      }
    }
    
    if (!found) {
      console.log(`Message ${messageId} not found in any accessible channel`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
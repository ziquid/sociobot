#!/usr/bin/env node

/**
 * List all channels the bot has access to
 * Usage: node list-channels.js <agent-name>
 */

import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { Client, Events, GatewayIntentBits, ChannelType } from "discord.js";
import { loadLastProcessedMessages } from "../lib/persistence.js";

const agentName = process.argv[2];
const DISCOVER_DMS = process.argv.includes('--discover-dms');
const DEBUG = process.argv.includes('--debug');

if (!agentName) {
  console.error('Usage: node list-channels.js <agent-name> [--discover-dms] [--debug]');
  console.error('Example: node list-channels.js test-agent');
  console.error('         node list-channels.js test-agent --discover-dms');
  console.error('         node list-channels.js test-agent --debug');
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot logged in as ${readyClient.user.tag}`);
  console.log("\n=== CHANNELS BOT HAS ACCESS TO ===\n");
  
  let lastMessages = {};
  if (DEBUG) {
    lastMessages = loadLastProcessedMessages(agentName);
  }
  
  const getDebugInfo = async (channelId, channel) => {
    if (!DEBUG) return '';
    // Skip debug info for channels that don't support messages
    if (channel.type === ChannelType.GuildCategory || channel.type === ChannelType.GuildVoice) {
      return '';
    }
    let info = '';
    if (lastMessages[channelId]) {
      try {
        const lastMessage = await channel.messages.fetch(lastMessages[channelId]);
        info = ` [Last: "${lastMessage.content.substring(0, 100)}"]`;
      } catch (error) {
        info = ` [Last: ${lastMessages[channelId]} - message not found]`;
      }
    } else {
      try {
        const recentMessages = await channel.messages.fetch({ limit: 1 });
        if (recentMessages.size > 0) {
          const recent = recentMessages.first();
          info = ` [Last: no data in persistence file, Recent: "${recent.content.substring(0, 100)}"]`;
        } else {
          info = ` [Last: no data in persistence file, no messages found]`;
        }
      } catch (error) {
        info = ` [Last: no data in persistence file, cannot fetch messages]`;
      }
    }
    return info;
  };
  
  const typeNames = {
    [ChannelType.GuildText]: 'TEXT',
    [ChannelType.GuildVoice]: 'VOICE',
    [ChannelType.GuildCategory]: 'CATEGORY',
    [ChannelType.DM]: 'DM',
    [ChannelType.GuildForum]: 'FORUM'
  };
  
  // Show guild channels
  const guilds = readyClient.guilds.cache;
  for (const [guildId, guild] of guilds) {
    console.log(`Server: ${guild.name} (${guildId})`);
    
    const channels = guild.channels.cache.filter(channel => 
      channel.permissionsFor(readyClient.user)?.has('ViewChannel')
    );
    
    for (const [channelId, channel] of channels) {
      const typeName = typeNames[channel.type] || `TYPE_${channel.type}`;
      const debugInfo = await getDebugInfo(channelId, channel);
      console.log(`  ${typeName}: #${channel.name} (${channelId})${debugInfo}`);
    }
    console.log();
  }
  
  // Show DM channels
  const dmChannels = new Map();
  
  // Add cached DM channels
  const cachedDMs = readyClient.channels.cache.filter(channel => 
    channel.type === ChannelType.DM
  );
  for (const [id, channel] of cachedDMs) {
    dmChannels.set(id, channel);
  }
  
  // Fetch DM channels from environment
  const knownDMChannels = process.env.DM_CHANNEL_IDS?.split(',') || [];
  for (const channelId of knownDMChannels) {
    if (!dmChannels.has(channelId)) {
      try {
        const channel = await readyClient.channels.fetch(channelId);
        if (channel && channel.type === ChannelType.DM) {
          dmChannels.set(channelId, channel);
        }
      } catch (error) {
        console.log(`  Could not fetch DM channel ${channelId}: ${error.message}`);
      }
    }
  }
  
  // Try to create DM with TEST_USER_ID if configured
  if (process.env.TEST_USER_ID) {
    try {
      const user = await readyClient.users.fetch(process.env.TEST_USER_ID);
      const dmChannel = await user.createDM();
      if (!dmChannels.has(dmChannel.id)) {
        dmChannels.set(dmChannel.id, dmChannel);
      }
    } catch (error) {
      console.log(`  Could not create DM with TEST_USER_ID: ${error.message}`);
    }
  }
  
  // Discover DMs by attempting to create DM channels with server members
  if (DISCOVER_DMS) {
    console.log('\n🔍 Discovering DM channels...');
    for (const [guildId, guild] of guilds) {
      try {
        const members = await guild.members.fetch({ limit: 10 });
        for (const [userId, member] of members) {
          if (member.user.bot || member.user.id === readyClient.user.id) continue;
          try {
            const dmChannel = await member.user.createDM();
            if (!dmChannels.has(dmChannel.id)) {
              dmChannels.set(dmChannel.id, dmChannel);
              console.log(`  Found DM: ${member.user.username} (${dmChannel.id})`);
            }
          } catch (error) {
            // Silently skip users we can't DM
          }
        }
      } catch (error) {
        console.log(`  Error fetching members from ${guild.name}: ${error.message}`);
      }
    }
  }
  
  if (dmChannels.size > 0) {
    console.log('Direct Messages:');
    for (const [channelId, channel] of dmChannels) {
      const debugInfo = await getDebugInfo(channelId, channel);
      console.log(`  DM: ${channel.recipient?.username || 'Unknown'} (${channelId})${debugInfo}`);
    }
    console.log();
  }
  
  process.exit(0);
});

client.login(DISCORD_TOKEN);

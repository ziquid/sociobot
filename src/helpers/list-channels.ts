#!/usr/bin/env bun

/**
 * List all channels the bot has access to
 * Usage: list-channels [--discover-dms] [--debug]
 */

import { Client, Events, GatewayIntentBits, ChannelType, TextChannel, DMChannel, VoiceChannel, CategoryChannel, ForumChannel, Guild, GuildChannel } from 'discord.js';
import { loadLastProcessedMessages } from '../lib/persistence.js';
import { getConfig } from '../lib/config.js';

// Check for help option
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
List Channels - Display all Discord channels accessible to the bot

USAGE:
  list-channels [options]

OPTIONS:
  --discover-dms    Attempt to discover DM channels
  --debug          Show debug information
  --help, -h       Show this help message

EXAMPLES:
  list-channels
  list-channels --discover-dms
  list-channels --debug

NOTE:
  Agent handle is read from ZDS_AI_AGENT_HANDLE environment variable
`);
  process.exit(0);
}

// Get agent handle from environment variable
const agentHandle = process.env.ZDS_AI_AGENT_HANDLE;
if (!agentHandle) {
  console.error('Error: ZDS_AI_AGENT_HANDLE environment variable is not set');
  process.exit(1);
}

const DISCOVER_DMS = process.argv.includes('--discover-dms');
const DEBUG = process.argv.includes('--debug');

// Load configuration
const config = getConfig(agentHandle);
const DISCORD_TOKEN = config.discord.token;

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

  let lastMessages: Record<string, string> = {};
  if (DEBUG) {
    lastMessages = loadLastProcessedMessages(agentHandle);
  }

  const getDebugInfo = async (channelId: string, channel: any): Promise<string> => {
    if (!DEBUG) return '';
    // Skip debug info for channels that don't support messages
    if (channel.type === ChannelType.GuildCategory || channel.type === ChannelType.GuildVoice) {
      return '';
    }

    // Type guard to check if channel supports messages
    if (!('messages' in channel)) {
      return '';
    }

    const messageChannel = channel as TextChannel | DMChannel;
    let info = '';
    if (lastMessages[channelId]) {
      try {
        const lastMessage = await messageChannel.messages.fetch(lastMessages[channelId]);
        info = ` [Last: "${lastMessage.content.substring(0, 100)}"]`;
      } catch (error) {
        info = ` [Last: ${lastMessages[channelId]} - message not found]`;
      }
    } else {
      try {
        const recentMessages = await messageChannel.messages.fetch({ limit: 1 });
        if (recentMessages.size > 0) {
          const recent = recentMessages.first();
          if (recent) {
            info = ` [Last: no data in persistence file, Recent: "${recent.content.substring(0, 100)}"]`;
          }
        } else {
          info = ` [Last: no data in persistence file, no messages found]`;
        }
      } catch (error) {
        info = ` [Last: no data in persistence file, cannot fetch messages]`;
      }
    }
    return info;
  };

  const typeNames: Record<ChannelType, string> = {
    [ChannelType.GuildText]: 'TEXT',
    [ChannelType.GuildVoice]: 'VOICE',
    [ChannelType.GuildCategory]: 'CATEGORY',
    [ChannelType.DM]: 'DM',
    [ChannelType.GuildForum]: 'FORUM',
    [ChannelType.GroupDM]: 'GROUP_DM',
    [ChannelType.GuildAnnouncement]: 'ANNOUNCEMENT',
    [ChannelType.AnnouncementThread]: 'ANNOUNCEMENT_THREAD',
    [ChannelType.PublicThread]: 'PUBLIC_THREAD',
    [ChannelType.PrivateThread]: 'PRIVATE_THREAD',
    [ChannelType.GuildStageVoice]: 'STAGE_VOICE',
    [ChannelType.GuildDirectory]: 'DIRECTORY',
    [ChannelType.GuildMedia]: 'MEDIA'
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
  const dmChannels = new Map<string, DMChannel>();

  // Add cached DM channels
  const cachedDMs = readyClient.channels.cache.filter(channel =>
    channel.type === ChannelType.DM
  );
  for (const [id, channel] of cachedDMs) {
    if (channel.type === ChannelType.DM) {
      dmChannels.set(id, channel as DMChannel);
    }
  }

  // Fetch DM channels from configuration
  const knownDMChannels = config.discord.dmChannelIds;
  for (const channelId of knownDMChannels) {
    if (!dmChannels.has(channelId)) {
      try {
        const channel = await readyClient.channels.fetch(channelId);
        if (channel && channel.type === ChannelType.DM) {
          dmChannels.set(channelId, channel as DMChannel);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  Could not fetch DM channel ${channelId}: ${errorMessage}`);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  Could not create DM with TEST_USER_ID: ${errorMessage}`);
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  Error fetching members from ${guild.name}: ${errorMessage}`);
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

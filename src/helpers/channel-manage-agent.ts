#!/usr/bin/env bun

import { Client, GatewayIntentBits, TextChannel, PermissionsBitField } from 'discord.js';
import { getConfig } from '../lib/config.js';

// Usage: sb-channel-manage-agent <channel-id-or-name> add <user-id>
//        sb-channel-manage-agent <channel-id-or-name> remove <user-id>
// Agent handle is read from ZDS_AI_AGENT_HANDLE environment variable

const agentHandle = process.env.ZDS_AI_AGENT_HANDLE;
const channelInput = process.argv[2];
const action = process.argv[3];
const targetUserId = process.argv[4];

if (!channelInput || channelInput === '-h' || channelInput === '--help') {
  console.error('Usage: sb-channel-manage-agent <channel-id-or-name> add <user-id>');
  console.error('   OR: sb-channel-manage-agent <channel-id-or-name> remove <user-id>');
  console.error('');
  console.error('Examples:');
  console.error('  sb-channel-manage-agent sw-dev add 1234567890123456789');
  console.error('  sb-channel-manage-agent 1425504341191688263 remove 9876543210987654321');
  console.error('');
  console.error('Note: Agent handle is read from ZDS_AI_AGENT_HANDLE environment variable');
  console.error('Note: The agent must own the channel (OWNED_CHANNELS env var) to manage it');
  process.exit(1);
}

if (!agentHandle) {
  console.error('Error: ZDS_AI_AGENT_HANDLE environment variable not set');
  process.exit(1);
}

if (action !== 'add' && action !== 'remove') {
  console.error(`Error: action must be "add" or "remove", got: ${action}`);
  process.exit(1);
}

if (!targetUserId || !/^\d+$/.test(targetUserId)) {
  console.error('Error: user-id must be a numeric Discord user ID');
  process.exit(1);
}

const ownedChannels = (process.env.OWNED_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);

const config = getConfig(agentHandle);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

async function resolveChannel(input: string): Promise<TextChannel> {
  if (/^\d+$/.test(input)) {
    try {
      const channel = await client.channels.fetch(input);
      if (channel && channel.isTextBased()) {
        return channel as TextChannel;
      }
    } catch {
      // fall through to name search
    }
  }

  const name = input.replace(/^#/, '');
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find(ch => ch.name === name);
    if (channel && channel.isTextBased()) {
      return channel as TextChannel;
    }
  }

  throw new Error(`Channel not found: ${input}`);
}

client.once('ready', async () => {
  console.log(`Connected as ${client.user?.tag}`);

  try {
    const channel = await resolveChannel(channelInput);

    // Verify this agent owns the channel
    if (!ownedChannels.includes(channel.id)) {
      console.error(`Error: This agent does not own channel ${channelInput} (channel ID: ${channel.id})`);
      console.error(`Owned channels: ${ownedChannels.join(', ') || '(none)'}`);
      process.exit(1);
    }

    if (action === 'add') {
      await channel.permissionOverwrites.create(targetUserId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      console.log(`Added user ${targetUserId} to #${channel.name} (${channel.id})`);
    } else {
      await channel.permissionOverwrites.delete(targetUserId);
      console.log(`Removed user ${targetUserId} from #${channel.name} (${channel.id})`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to ${action} agent:`, errorMessage);
    process.exit(1);
  }

  process.exit(0);
});

client.login(config.discord.token);

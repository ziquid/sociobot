#!/usr/bin/env bun

import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { getConfig } from '../lib/config.js';

// Usage: sb-channel-manage-agent <channel-id-or-name> add <user-id>
//        sb-channel-manage-agent <channel-id-or-name> remove <user-id>

const agentHandle = process.env.ZDS_AI_AGENT_HANDLE;
const channelInput = process.argv[2];
const action = process.argv[3];
const targetUserId = process.argv[4];

if (!channelInput || channelInput === '-h' || channelInput === '--help') {
  console.error('Usage: sb-channel-manage-agent <channel-id-or-name> add <user-id>');
  console.error('   OR: sb-channel-manage-agent <channel-id-or-name> remove <user-id>');
  process.exit(1);
}

if (!agentHandle) { console.error('Error: ZDS_AI_AGENT_HANDLE not set'); process.exit(1); }
if (action !== 'add' && action !== 'remove') { console.error(`Error: action must be "add" or "remove"`); process.exit(1); }
if (!targetUserId || !/^\d+$/.test(targetUserId)) { console.error('Error: user-id must be numeric'); process.exit(1); }

const ownedChannels = (process.env.OWNED_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);
const config = getConfig(agentHandle);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

async function resolveChannel(input: string): Promise<TextChannel> {
  if (/^\d+$/.test(input)) {
    try { const ch = await client.channels.fetch(input); if (ch && ch.isTextBased()) return ch as TextChannel; } catch {}
  }
  const name = input.replace(/^#/, '');
  for (const guild of client.guilds.cache.values()) {
    const ch = guild.channels.cache.find(c => c.name === name);
    if (ch && ch.isTextBased()) return ch as TextChannel;
  }
  throw new Error(`Channel not found: ${input}`);
}

client.once('ready', async () => {
  try {
    const channel = await resolveChannel(channelInput);
    if (!ownedChannels.includes(channel.id)) {
      console.error(`Error: This agent does not own channel ${channelInput} (ID: ${channel.id})`);
      process.exit(1);
    }
    if (action === 'add') {
      await channel.permissionOverwrites.create(targetUserId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      console.log(`Added user ${targetUserId} to #${channel.name}`);
    } else {
      await channel.permissionOverwrites.delete(targetUserId);
      console.log(`Removed user ${targetUserId} from #${channel.name}`);
    }
  } catch (error) {
    console.error(`Failed to ${action}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
  process.exit(0);
});

client.login(config.discord.token);

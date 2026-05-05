#!/usr/bin/env bun

/**
 * Remove an agent from a Discord channel by deleting their permission overwrite.
 * Usage: sb-remove-channel-agent <channel-id-or-name> <agent-name>
 * Requires: caller's bot must have ManageChannels permission.
 */

import { Client, GatewayIntentBits, ChannelType, TextChannel } from 'discord.js';
import { getConfig } from '../lib/config.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const agentHandle = process.env.ZDS_AI_AGENT_HANDLE;
const channelArg = process.argv[2];
const targetAgentName = process.argv[3];

if (!channelArg || !targetAgentName || channelArg === '--help' || channelArg === '-h') {
  console.error('Usage: sb-remove-channel-agent <channel-id-or-name> <agent-name>');
  console.error('');
  console.error('Removes the named agent\'s ViewChannel + SendMessages overwrite from the channel.');
  console.error('The calling bot must own the channel and have ManageChannels permission.');
  console.error('');
  console.error('Examples:');
  console.error('  sb-remove-channel-agent cbr tess');
  console.error('  sb-remove-channel-agent 1234567890123456789 aiden');
  process.exit(1);
}

if (!agentHandle) {
  console.error('Error: ZDS_AI_AGENT_HANDLE environment variable not set');
  process.exit(1);
}

const config = getConfig(agentHandle);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('clientReady', async (readyClient) => {
  try {
    // Resolve channel
    let channel: TextChannel | null = null;
    for (const guild of readyClient.guilds.cache.values()) {
      await guild.members.fetch();
      const channelName = channelArg.replace(/^#/, '');
      const found = /^\d+$/.test(channelArg)
        ? guild.channels.cache.get(channelArg)
        : guild.channels.cache.find(c => c.name === channelName);
      if (found && found.type === ChannelType.GuildText) {
        channel = found as TextChannel;
        break;
      }
    }

    if (!channel) {
      console.error(`Error: channel not found: ${channelArg}`);
      process.exit(1);
    }

    const guild = channel.guild;

    // Find the target agent's bot user by matching username (case-insensitive)
    const lowerTarget = targetAgentName.toLowerCase();
    const targetMember = guild.members.cache.find(member => {
      if (!member.user.bot) return false;
      const username = member.user.username.toLowerCase();
      const displayName = member.displayName.toLowerCase();
      return username.includes(lowerTarget) || displayName.includes(lowerTarget);
    });

    if (!targetMember) {
      console.error(`Error: no bot member found matching agent name "${targetAgentName}"`);
      process.exit(1);
    }

    // Remove the channel permission overwrite entirely
    const overwrite = channel.permissionOverwrites.cache.get(targetMember.user.id);
    if (!overwrite) {
      console.log(`No overwrite found for ${targetMember.user.username} on #${channel.name} — nothing to remove`);
      process.exit(0);
    }

    await overwrite.delete();
    console.log(`Removed ${targetMember.user.username} (${targetMember.user.id}) from #${channel.name}`);
    process.exit(0);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
});

client.login(config.discord.token);

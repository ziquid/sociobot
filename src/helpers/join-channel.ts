#!/usr/bin/env bun

import { Client, GatewayIntentBits, GuildChannel, AnyThreadChannel, BaseGuildTextChannel } from 'discord.js';
import { getConfig } from '../lib/config.js';

const agentHandle = process.env.ZDS_AI_AGENT_HANDLE;
const channelInput = process.argv[2];

if (!channelInput || channelInput === '-h' || channelInput === '--help') {
  console.error('Usage: sb-join-channel <channel-id-or-name>');
  console.error('');
  console.error('Grants the bot ViewChannel, SendMessages, and ReadMessageHistory access');
  console.error('to the specified channel via a Discord permission overwrite.');
  console.error('For threads, joins the thread directly.');
  console.error('');
  console.error('Examples:');
  console.error('  sb-join-channel sw-dev');
  console.error('  sb-join-channel 1234567890123456789');
  console.error('  sb-join-channel #bot-testing');
  console.error('');
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
  ]
});

async function resolveChannel(input: string): Promise<GuildChannel | AnyThreadChannel> {
  const byId = /^\d+$/.test(input);
  const name = input.replace(/^#/, '');

  for (const guild of client.guilds.cache.values()) {
    // Fetch all channels including restricted ones (requires ManageChannels in the guild)
    await guild.channels.fetch();

    const ch = byId
      ? guild.channels.cache.get(input)
      : guild.channels.cache.find(c => c.name === name);

    if (ch) return ch as GuildChannel | AnyThreadChannel;
  }

  throw new Error(`Channel not found: ${input}`);
}

client.once('clientReady', async (readyClient) => {
  console.log(`Connected as ${readyClient.user.tag}`);

  try {
    const channel = await resolveChannel(channelInput);

    if (channel.isThread()) {
      await channel.join();
      console.log(`Joined thread #${channel.name} (${channel.id}) successfully`);
    } else {
      const perms = (channel as GuildChannel).permissionsFor(readyClient.user);
      if (perms?.has('ViewChannel')) {
        console.log(`Already have access to #${channel.name} (${channel.id})`);
      } else {
        await (channel as BaseGuildTextChannel).permissionOverwrites.create(readyClient.user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        console.log(`Joined #${channel.name} (${channel.id}) successfully`);
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to join channel:', errorMessage);
    process.exit(1);
  }

  process.exit(0);
});

client.login(config.discord.token);

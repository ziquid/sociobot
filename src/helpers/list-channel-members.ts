#!/usr/bin/env bun

/**
 * List members of a Discord channel
 * Usage: list-channel-members <channel-id-or-name>
 */

import { Client, Events, GatewayIntentBits, ChannelType, GuildMember, TextChannel, VoiceChannel } from 'discord.js';
import { getConfig } from '../lib/config.js';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
List Channel Members - Display current members of a Discord channel

USAGE:
  list-channel-members <channel-id-or-name>

ARGUMENTS:
  channel-id-or-name   Numeric channel ID or channel name (e.g. "sw-dev")

OPTIONS:
  --help, -h           Show this help message

OUTPUT:
  For text/forum channels: members who have ViewChannel permission
  For voice channels: members currently connected

EXAMPLES:
  list-channel-members sw-dev
  list-channel-members 1425504341191688263

NOTE:
  Agent handle is read from ZDS_AI_AGENT_HANDLE environment variable
`);
  process.exit(0);
}

const agentHandle = process.env.ZDS_AI_AGENT_HANDLE;
if (!agentHandle) {
  console.error('Error: ZDS_AI_AGENT_HANDLE environment variable is not set');
  process.exit(1);
}

const channelInput = process.argv[2];
if (!channelInput) {
  console.error('Error: Channel ID or name is required');
  console.error('Usage: list-channel-members <channel-id-or-name>');
  process.exit(1);
}

const config = getConfig(agentHandle);
const DISCORD_TOKEN = config.discord.token;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

async function resolveChannel(input: string) {
  if (/^\d+$/.test(input)) {
    try {
      return await client.channels.fetch(input);
    } catch {
      console.error(`Error: Could not fetch channel with ID ${input}`);
      process.exit(1);
    }
  }

  const name = input.replace(/^#/, '');
  const matches: { id: string; name: string; guildName: string }[] = [];

  for (const [, guild] of client.guilds.cache) {
    for (const [id, channel] of guild.channels.cache) {
      if ('name' in channel && channel.name === name) {
        matches.push({ id, name: channel.name, guildName: guild.name });
      }
    }
  }

  if (matches.length === 0) {
    console.error(`Error: No channel found with name '${name}'`);
    process.exit(1);
  }

  if (matches.length > 1) {
    console.error(`Error: Multiple channels found with name '${name}':`);
    for (const m of matches) {
      console.error(`  - ${m.guildName}: #${m.name} (${m.id})`);
    }
    console.error('Please use the channel ID to disambiguate.');
    process.exit(1);
  }

  return client.channels.cache.get(matches[0].id)!;
}

client.once(Events.ClientReady, async () => {
  try {
    const channel = await resolveChannel(channelInput);

    if (!channel) {
      console.error(`Error: Channel not found: ${channelInput}`);
      process.exit(1);
    }

    if (channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM) {
      console.error('Error: DM channels do not have members in the guild sense');
      process.exit(1);
    }

    if (!('guild' in channel)) {
      console.error('Error: Channel is not a guild channel');
      process.exit(1);
    }

    const guildChannel = channel as TextChannel | VoiceChannel;

    // Fetch all members to ensure cache is populated
    await guildChannel.guild.members.fetch();

    const members = guildChannel.members as Map<string, GuildMember>;

    const channelTypeName =
      channel.type === ChannelType.GuildVoice ? 'voice' :
      channel.type === ChannelType.GuildStageVoice ? 'stage' : 'text';

    const channelName = 'name' in channel ? channel.name : channelInput;

    console.log(`Channel: #${channelName} (${channel.id}) [${channelTypeName}]`);
    if ('guild' in channel) {
      console.log(`Server: ${guildChannel.guild.name}`);
    }
    console.log(`Members: ${members.size}\n`);

    for (const [, member] of members) {
      const nick = member.nickname ? ` (${member.nickname})` : '';
      const bot = member.user.bot ? ' [bot]' : '';
      console.log(`  ${member.user.username}${nick}${bot} — ${member.id}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${msg}`);
    process.exit(1);
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);

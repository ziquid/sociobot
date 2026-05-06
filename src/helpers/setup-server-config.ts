#!/usr/bin/env bun

import { Client, GatewayIntentBits } from 'discord.js';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../lib/config.js';

// Usage: sb-setup-server-config [--role <role-id>] [--guild <guild-id>]
//
// With no flags: lists guilds and roles so you can identify the ZDS AI Agents role ID.
// With --role <id>: writes the server config file for each guild (or --guild <id> for one).

const agentHandle = process.env.ZDS_AI_AGENT_HANDLE;
if (!agentHandle) {
  console.error('Error: ZDS_AI_AGENT_HANDLE not set');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(`sb-setup-server-config — create /usr/local/share/zds-ai/data/sociobot/servers/<guildId>.json

USAGE
  sb-setup-server-config                         List guilds and roles (discover mode)
  sb-setup-server-config --role <role-id>        Write config for all guilds using role ID
  sb-setup-server-config --role <role-id> --guild <guild-id>   Write config for one guild

The generated file tells sociobot which Discord role identifies ZDS AI Agents, enabling
accurate per-channel ACL calculation (max ACL = 5 minus bot count in that channel).`);
  process.exit(0);
}

const roleIdx = args.indexOf('--role');
const roleId = roleIdx !== -1 ? args[roleIdx + 1] : null;

const guildIdx = args.indexOf('--guild');
const targetGuildId = guildIdx !== -1 ? args[guildIdx + 1] : null;

const config = getConfig(agentHandle);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  try {
    const guilds = targetGuildId
      ? [client.guilds.cache.get(targetGuildId)].filter(Boolean)
      : [...client.guilds.cache.values()];

    if (guilds.length === 0) {
      console.error(targetGuildId
        ? `Error: Guild ${targetGuildId} not found — is the bot a member?`
        : 'Error: Bot is not in any guilds');
      process.exit(1);
    }

    if (!roleId) {
      console.log('Discover mode — listing guilds and roles:\n');
      for (const guild of guilds) {
        console.log(`Guild: ${guild!.name} (${guild!.id})`);
        const roles = await guild!.roles.fetch();
        for (const [id, role] of roles) {
          console.log(`  ${role.name.padEnd(32)} ${id}`);
        }
        console.log();
      }
      console.log('Re-run with --role <role-id> to write the config files.');
      process.exit(0);
    }

    const zdsAiRoot = process.env.ZDS_AI_ROOT || '/usr/local/share/zds-ai';
    const serversDir = join(zdsAiRoot, 'data', 'sociobot', 'servers');
    mkdirSync(serversDir, { recursive: true });

    for (const guild of guilds) {
      const outPath = join(serversDir, `${guild!.id}.json`);
      const payload = JSON.stringify({ zdsAiAgentsRoleId: roleId }, null, 2);
      writeFileSync(outPath, payload + '\n', 'utf8');
      console.log(`Wrote: ${outPath}`);
    }

  } catch (err) {
    console.error('Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
  process.exit(0);
});

client.login(config.discord.token);

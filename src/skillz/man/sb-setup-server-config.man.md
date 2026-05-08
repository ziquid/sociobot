---
name: sb-setup-server-config
purpose: create per-guild server config files so sociobot can calculate per-channel ACL correctly
invocation: sb-setup-server-config [--role <role-id>] [--guild <guild-id>]
audience: admin
relevance: when onboarding a new Discord server or adding a new ZDS AI Agents role
---

# sb-setup-server-config

Create `/usr/local/share/zds-ai/data/sociobot/servers/<guild-id>.json` for each guild the bot
is in.  The config file tells sociobot which Discord role identifies ZDS AI Agent bots, enabling
accurate per-channel ACL calculation (max ACL = 5 minus number of bots visible in that channel).

Without a config file, sociobot falls back to a default max ACL of 2 for all channels.

## USAGE

`sb-setup-server-config [--role <role-id>] [--guild <guild-id>]`

## OPTIONS

- `--role <role-id>`: Discord role ID for the ZDS AI Agents role; writes config files when provided
- `--guild <guild-id>`: Limit to a single guild (optional; defaults to all guilds)
- `--help, -h`: Show a help message

## WORKFLOW

Run without flags first to list guilds and roles, then re-run with `--role` to write the files:

```bash
# Step 1 — discover guilds and role IDs
sb-setup-server-config

# Step 2 — write config for all guilds
sb-setup-server-config --role 1234567890123456789

# Step 2 (single guild) — write config for one guild only
sb-setup-server-config --role 1234567890123456789 --guild 9876543210987654321
```

## EXAMPLES

1. `sb-setup-server-config`
1. `sb-setup-server-config --role 1234567890123456789`
1. `sb-setup-server-config --role 1234567890123456789 --guild 9876543210987654321`

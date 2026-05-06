# Server Configuration Files

Each Discord guild that sociobot operates in needs a JSON config file at:

```
/usr/local/share/zds-ai/data/sociobot/servers/<guild-id>.json
```

## Schema

```json
{
  "zdsAiAgentsRoleId": "<discord-role-id>"
}
```

`zdsAiAgentsRoleId` — the Discord role ID assigned to all ZDS AI agent bots in the guild.
Sociobot counts how many agents with this role have access to a channel to calculate the
channel's max ACL.  Without it, all channels default to ACL 2.

## Setup

Use `sb-setup-server-config` to discover guild IDs and create the files automatically:

```bash
# List guilds and roles (dry run)
sb-setup-server-config

# Write config for all guilds using the given ZDS AI Agents role ID
sb-setup-server-config --role <role-id>

# Write config for a specific guild only
sb-setup-server-config --guild <guild-id> --role <role-id>
```

See `example.json` for the file format.

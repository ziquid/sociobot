---
name: sb-channel-manage-agent
purpose: add or remove a user from a Discord channel you own
invocation:
  - sb-channel-manage-agent <channel-id-or-name> add <user-id>
  - sb-channel-manage-agent <channel-id-or-name> remove <user-id>
audience: agents
relevance: when you own a channel and need to grant or revoke another agent's access
---

# sb-channel-manage-agent

Add or remove a user's Discord permission overwrite on a channel you own.

## USAGE

- `sb-channel-manage-agent <channel-id-or-name> add <user-id>`
- `sb-channel-manage-agent <channel-id-or-name> remove <user-id>`

## ARGUMENTS

| Argument | Description |
|----------|-------------|
| `channel-id-or-name` | Numeric channel ID or channel name (strip `#` prefix) |
| `add` \| `remove` | Action to perform |
| `user-id` | Numeric Discord user ID of the agent to add or remove |

## NOTES

- You must own the channel (set via `OWNED_CHANNELS` in your bot config's `owned_channels` field)
- `add` grants ViewChannel, SendMessages, and ReadMessageHistory via a permission overwrite
- `remove` deletes the permission overwrite for the user
- The bot must have `ManageChannels` permission in the target channel

## EXAMPLES

1. `sb-channel-manage-agent sw-dev add 1462933526772191242`
1. `sb-channel-manage-agent 1425504341191688263 remove 1462933526772191242`
1. `sb-channel-manage-agent #my-channel add 1234567890123456789`

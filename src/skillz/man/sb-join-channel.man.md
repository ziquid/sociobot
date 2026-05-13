---
name: sb-join-channel
purpose: grant the bot access to a Discord channel via permission overwrite
invocation: sb-join-channel <channel-id-or-name>
audience: agents
relevance: when the bot needs access to a channel it cannot currently see or post in
---

# sb-join-channel

Add the calling bot as a member of a Discord channel by creating a permission overwrite granting ViewChannel, SendMessages, and ReadMessageHistory access.  For threads, joins the thread directly.

## USAGE

`sb-join-channel <channel-id-or-name>`

## ARGUMENTS

| Argument | Description |
|----------|-------------|
| `channel-id-or-name` | Numeric channel ID or channel name (e.g. `sw-dev` or `#sw-dev`) |

## BEHAVIOR

- **Regular channels**: Creates a per-member permission overwrite granting ViewChannel, SendMessages, and ReadMessageHistory.  If the bot already has ViewChannel access, reports success without creating a duplicate overwrite.
- **Threads** (public, private, announcement): Calls the Discord thread join API directly.

## NOTES

- Regular channel overwrites do not affect role-based permissions
- The bot must have `ManageChannels` permission in the guild for regular channels
- Useful for gaining access to private or restricted channels

## EXAMPLES

1. `sb-join-channel sw-dev`
1. `sb-join-channel 1234567890123456789`
1. `sb-join-channel #bot-testing`

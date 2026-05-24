---
name: sb-send-message
description: send a message via Discord or add an emoji reaction to a message
invocation:
  - sb-send-message [--encode] <channel-id-or-name> "message"
  - sb-send-message dm <user-id> "message"
  - sb-send-message webhook <channel-id-or-name> "message"
  - sb-send-message <channel-id-or-name> <message-id> "REACTION:<emoji>"
audience: agents
relevance: when using discord
---

# sb-send-message

Send a message via Discord or add an emoji reaction to an existing message.

## USAGE

- `sb-send-message [--encode] <channel-id-or-name> "message"`
- `sb-send-message dm <user-id> "message"`
- `sb-send-message webhook <channel-id-or-name> "message"`
- `sb-send-message <channel-id-or-name> <message-id> "REACTION:<emoji>"`

## FLAGS

`--encode` — Encode the message text as audio (or lip-synced video if a video provider is configured) and attach the result to the first Discord chunk.  Encoding is skipped silently when the target is the agent DM channel.  Falls back to text-only if encoding fails.

## SENDING A MESSAGE TO A CHANNEL

Send a message to any Discord channel by name or numeric ID.

```
sb-send-message <channel-name-or-id> "message"
sb-send-message --encode <channel-name-or-id> "message"
```

Use the channel name or the numeric channel ID.  Channel names are resolved automatically.

### Notes

- Messages longer than 2000 characters are automatically split into multiple chunks.
- Use `--encode` to attach audio/video to the first chunk.
- Check channel membership before tagging someone -- do not tag agents in channels they are not in.

## SENDING A DM TO A USER

Send a direct message to a human user by their Discord user ID.

```
sb-send-message dm <user-id> "message"
```

The `dm` subcommand is for human users only.  It requires the user's numeric Discord ID (not their username or display name).

### Finding User IDs

User IDs are numeric strings (e.g., `405193688155815940`).  You can find them in message metadata when messages are delivered to you -- the author ID is included in the message context.

### When to DM vs. Use a Channel

- DM when the message is private, personal, or only relevant to one person.
- Use a channel when the information benefits the team or needs visibility.
- Never DM sensitive information that should be on the record in a team channel.

## SENDING A DM TO AN AGENT

Agent-to-agent direct messages use the agent DM channel, NOT the `dm` subcommand.  The `dm` subcommand only works for human users.

```
sb-send-message the agent DM channel "Hey @AgentName -- your message here"
```

Messages sent to the agent DM channel are routed to the mentioned agent.  Include an `@mention` of the target agent in your message text so routing works correctly.

### How Agent DM Routing Works

1. You send a message to the agent DM channel mentioning the target agent.
2. The routing bot delivers the message to the mentioned agent.
3. The target agent can reply in the same channel.

### When to Use the agent DM channel vs. Team Channels

- Use the agent DM channel for private agent-to-agent coordination that doesn't need team visibility.
- Use team channels when the conversation benefits others or needs to be on the record.
- If the routing bot rejects your message (❌ reaction), the target agent may not be available via that channel.

## REACTION SYNTAX

To add an emoji reaction to an existing message, pass the message ID as the second argument and `REACTION:<emoji>` as the message body.  The emoji may be a Unicode character, a common name, or a custom guild emoji name:

| Name | Emoji |
|------|-------|
| `thumbsup` or `+1` | 👍 |
| `thumbsdown` or `-1` | 👎 |
| `heart` | ❤️ |
| `white_check_mark` or `check` | ✅ |
| `x`, `cross`, or `no_entry` | ❌ / 🚫 |
| `eyes` | 👀 |
| `fire` | 🔥 |
| `tada` | 🎉 |
| `rocket` | 🚀 |
| `clap` | 👏 |
| `pray` | 🙏 |
| `wave` | 👋 |
| `ok_hand` or `ok` | 👌 |
| `thinking` | 🤔 |
| `bulb` | 💡 |
| `warning` | ⚠️ |
| `question` | ❓ |
| `star` | ⭐ |
| `raised_hands` | 🙌 |
| `saluting_face` | 🫡 |

## EXAMPLES

1. `sb-send-message 1234567890 "Hello channel!"`
1. `sb-send-message my-channel "PR #42 is ready for review."`
1. `sb-send-message --encode my-channel "Hello channel!"`
1. `sb-send-message dm 405193688155815940 "Quick question about the timeline."`
1. `sb-send-message the agent DM channel "Hey @AgentName -- can you check ticket #12?"`
1. `sb-send-message webhook my-channel "Hello via webhook!"`
1. `sb-send-message my-channel 1234567890123456789 "REACTION:thumbsup"`
1. `sb-send-message my-channel 1234567890123456789 "REACTION:👍"`

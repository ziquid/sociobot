# Discord Reaction System Tutorial

## Overview

The Discord bot now supports two reaction features:
1. **Adding reactions** - You can react to messages instead of sending text
2. **Receiving notifications** - You'll be notified when anyone reacts to any message in channels you can read

## Adding Reactions (REACTION Directive)

Instead of sending a text reply, you can react to a message with an emoji by responding with:

```
REACTION:emoji_name
```

### Examples

```
REACTION:thumbsup
REACTION:100
REACTION:fire
REACTION:heart
```

You can optionally include trailing colons (both formats work):
```
REACTION:thumbsup:
REACTION:100:
```

### Available Emoji Names

| Emoji | Name | Usage |
|-------|------|-------|
| 👍 | thumbsup | `REACTION:thumbsup` |
| 👎 | thumbsdown | `REACTION:thumbsdown` |
| ❤️ | heart | `REACTION:heart` |
| 💯 | 100 | `REACTION:100` |
| 🔥 | fire | `REACTION:fire` |
| 👀 | eyes | `REACTION:eyes` |
| 🤔 | thinking | `REACTION:thinking` |
| 🎉 | tada | `REACTION:tada` |
| 🚀 | rocket | `REACTION:rocket` |
| ⭐ | star | `REACTION:star` |
| ✅ | check | `REACTION:check` |
| ❌ | x | `REACTION:x` |
| 👋 | wave | `REACTION:wave` |
| 👏 | clap | `REACTION:clap` |
| 🙏 | pray | `REACTION:pray` |
| 💪 | muscle | `REACTION:muscle` |
| 🧠 | brain | `REACTION:brain` |
| 💡 | bulb | `REACTION:bulb` |
| ⚠️ | warning | `REACTION:warning` |
| ❓ | question | `REACTION:question` |
| ❗ | exclamation | `REACTION:exclamation` |
| 😂 | laughing | `REACTION:laughing` |
| 😊 | smile | `REACTION:smile` |
| 😁 | grin | `REACTION:grin` |
| 😂 | joy | `REACTION:joy` |
| 🤣 | rofl | `REACTION:rofl` |
| 😎 | sunglasses | `REACTION:sunglasses` |
| 😭 | sob | `REACTION:sob` |
| 😱 | scream | `REACTION:scream` |
| 🤷 | shrug | `REACTION:shrug` |

### Advanced Usage

You can also use:
- **Unicode emojis directly**: `REACTION:💯`
- **Custom server emojis**: If you know the custom emoji name from the Discord server

## Receiving Reaction Notifications

You'll automatically receive notifications when **anyone** (humans or bots) reacts to **any message** in channels you can read.

### Notification Format

```
Reaction added by @username (ID: 123456789) in channel #general (ID: 987654321):

Reacted with 👍 to message from @OtherUser (ID: 111222333, Message ID: 444555666):
"This is the message content (up to 500 characters)..."

This message is for your information only. Do not reply -- replies to this message will not be processed.
```

### What You'll See

- Who added the reaction (username and ID)
- What channel it happened in (name and ID)
- What emoji was used
- Who wrote the original message (username and ID)
- The message ID
- Up to 500 characters of the original message content

## Use Cases

### When to Use REACTION Instead of Text

- **Acknowledgment**: Quick "got it" → `REACTION:thumbsup`
- **Agreement**: "I agree" → `REACTION:100`
- **Celebration**: "Awesome!" → `REACTION:tada`
- **Concern**: "Hmm, interesting" → `REACTION:thinking`
- **Approval**: "Good work" → `REACTION:fire`

### When to Still Use Text

- Complex responses requiring explanation
- Questions that need answers
- Multi-part discussions
- When context is needed

## Notes

- Reactions don't increment ACL (Agent Chain Length)
- Your response can still include `<think>` tags - they'll be stripped before checking for REACTION
- If the bot can't find the emoji name, you'll see an error in the logs
- Reaction notifications are informational only - responding to them won't send messages to Discord

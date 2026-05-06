---
name: sb-send-message
purpose: send a message via discord or add an emoji reaction to a message
invocation:
  - sb-send-message <channel-id-or-name> "message"
  - sb-send-message dm <user-id> "message"
  - sb-send-message webhook <channel-id-or-name> "message"
  - sb-send-message <channel-id-or-name> <message-id> "REACTION:<emoji>"
audience: agents
relevance: when using discord
---

# sb-send-message

Send a message via Discord or add an emoji reaction to an existing message.

## USAGE

- `sb-send-message <channel-id-or-name> "message"`
- `sb-send-message dm <user-id> "message"`
- `sb-send-message webhook <channel-id-or-name> "message"`
- `sb-send-message <channel-id-or-name> <message-id> "REACTION:<emoji>"`

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
1. `sb-send-message bot-testing "Hello channel!"`
1. `sb-send-message dm 9876543210 "Hello user!"`
1. `sb-send-message webhook bot-testing "Hello via webhook!"`
1. `sb-send-message bot-testing 1234567890123456789 "REACTION:thumbsup"`
1. `sb-send-message bot-testing 1234567890123456789 "REACTION:👍"`

---
name: sb-send-message
purpose: send a message via discord
invocation:
  - sb-send-message <channel-id-or-name> "message"
  - sb-send-message dm <user-id> "message"
  - sb-send-message webhook <channel-id-or-name> "message"
audience: agents
relevance: when using discord
---

# sb-send-message

Send a message via Discord.

## USAGE

- `sb-send-message <channel-id-or-name> "message"`
- `sb-send-message dm <user-id> "message"`
- `sb-send-message webhook <channel-id-or-name> "message"`

## EXAMPLES

1. `sb-send-message 1234567890 "Hello channel!"`
1. `sb-send-message bot-testing "Hello channel!"`
1. `sb-send-message dm 9876543210 "Hello user!"`
1. `sb-send-message webhook bot-testing "Hello via webhook!"`

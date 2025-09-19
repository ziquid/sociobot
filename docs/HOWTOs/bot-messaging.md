# Bot Messaging HOWTOs

## Send Messages to Channels

Send a message to any Discord channel:

```bash
node send-message.js <agent-name> <channel-id> "message text"
```

**Examples:**
```bash
node send-message.js testbot <channel-id> "Hello channel!"
```

## Send Direct Messages

Send a DM to any user:

```bash
node send-message.js <agent-name> dm <user-id> "message text"
```

**Examples:**
```bash
node send-message.js testbot dm <user-id> "Hello user!"
```

## Send Webhook Messages

Send messages using webhook credentials (appears as the bot):

```bash
node send-message.js <agent-name> webhook <channel-id> "message text"
```

**Examples:**
```bash
node send-message.js testbot webhook <channel-id> "Webhook message"
```

## Bot-to-Bot Communication

Since Discord bots cannot DM each other directly, use the dedicated #bot-dms channel:

```bash
# Bot sends message to bot-dms channel for other bots
node send-message.js testbot <bot-dms-channel-id> "Hi other bots!"

# Another bot responds in bot-dms channel
node send-message.js testbot2 <bot-dms-channel-id> "Hello!"
```

**Bot-DMs Channel ID:** `<bot-dms-channel-id>`

## Test Messaging

Test all messaging functionality:

```bash
# Test channel and DM messaging
node test-send-message.js

# Test only DM functionality
node test-send-message.js --dms-only
```

## Key Channel IDs

- **#bot-testing:** `<bot-testing-channel-id>`
- **#bot-dms:** `<bot-dms-channel-id>` (bot-to-bot communication)
- **#general:** `<general-channel-id>`

## Notes

- Long messages are automatically split at 2000 character Discord limit
- DM functionality requires valid user IDs
- Bot-to-bot DMs are impossible - use #bot-dms channel instead
- All bots have access to #bot-testing and #bot-dms channels
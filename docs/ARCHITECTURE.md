# ZDS Discord Bot Architecture

## Overview
Multi-agent Discord bot system with batch and real-time message processing, circuit breaker protection, and bot-to-bot communication support.

## Core Components

### Message Processing Pipeline
```
Startup: Discord Messages → processChannelMessages() → processBatchedMessages() → AI Response
Real-time: Discord Message → processRealtimeMessage() → AI Response
```

### Key Functions

#### Message Filtering
- `isOwnBotMessage(botUserId)` - Excludes bot's own messages
- `isAfterCutoff(cutoffId)` - Filters messages after cutoff ID
- `isBotDMsRelevant(botUserId)` - Bot-dms channel relevance filter

#### Processing Functions
- `processChannelMessages()` - Batch processes missed messages during startup
- `processBatchedMessages()` - AI processing for message arrays
- `processRealtimeMessage()` - Single message AI processing
- `checkBotDMsChannel()` - Special handling for bot-to-bot communication

## Channel Types

### Regular Channels
- Guild text channels with ViewChannel permission
- Processes all messages where bot has access

### DM Channels
- Direct messages between users and bot
- Cached and environment-configured channels
- Full message processing

### Bot-DMs Channel (ID: 1418032549430558782)
- Special channel for bot-to-bot communication
- Filters: mentions, replies to bot, human messages only
- Prevents bot response loops

## Circuit Breaker System
- **MAX_FAILURES**: 5 consecutive Q CLI errors triggers exit
- **MAX_LOAD_AVERAGE**: 21 system load triggers circuit breaker
- **Failure Tracking**: `consecutiveFailures` counter with context logging

## Message Flow

### Startup Sequence
1. Load last processed message IDs from persistence
2. Check DM channels for missed messages
3. Check bot-dms channel for relevant messages
4. Check guild channels (unless --dms-only)
5. Process queued real-time messages
6. Enter real-time monitoring mode

### Real-time Processing
1. Queue messages during startup
2. Apply bot message delay (17s + random 3s)
3. Filter by mentions, DMs, or ViewChannel permission
4. Process through AI and send responses

## Configuration

### Environment Variables
```
DISCORD_TOKEN       - Bot authentication token
BOT_USER_ID        - Bot's Discord user ID
WEBHOOK_ID         - Webhook for responses
WEBHOOK_TOKEN      - Webhook authentication
HTTP_PORT          - Optional HTTP server port
BOT_MESSAGE_DELAY  - Delay for bot message processing (default: 17000ms)
DM_CHANNEL_IDS     - Comma-separated known DM channel IDs
```

### Command Line Options
- `--run-once, -1` - Process missed messages then exit
- `--dms-only` - Process only DM channels
- `--debug-json` - Output JSON instead of Discord responses
- `--no-discord` - Process but skip Discord responses
- `--help, -h` - Show help message

## Error Handling
- Q CLI error detection and circuit breaker
- Discord delivery failure tracking
- Load average monitoring
- Graceful degradation and exit strategies
# ZDS Discord Bot Architecture

## Overview
Multi-agent Discord bot system with batch and real-time message processing, circuit breaker protection, bot-to-bot communication support, and ACL (Agent Chain Length) limiting to prevent infinite bot conversations.

## Core Components

### Message Processing Pipeline
```
Startup: Discord Messages → processChannelMessages() → processBatchedMessages() → AI Response → Discord (with ACL)
Real-time: Discord Message → processRealtimeMessage() → AI Response → Discord (with ACL)
```

### Modular Library Structure

#### lib/message-processing.js
Message filtering, error detection, and debug utilities:
- `isOwnBotMessage(botUserId)` - Excludes bot's own messages
- `isAfterCutoff(cutoffId)` - Filters messages after cutoff ID
- `isBotDMsRelevant(botUserId)` - Bot-dms channel relevance filter
- `isErrorResponse(response)` - Detects Q CLI errors
- `handleErrorResponse(context, state, maxFailures, logFn)` - Circuit breaker management
- `getChannelSlowdown(channelId, client)` - Channel rate limit detection
- `debugBotDMsRouting(messages, botUserId, debugEnabled, logFn)` - Debug logging

#### lib/metadata.js
ACL (Agent Chain Length) system for bot conversation control:
- `getACL(message)` - Extracts ACL from Discord message embed footer
- `createFooter(acl)` - Creates embed footer with ACL metadata
- `addCourtesyMessage(query)` - Adds courtesy message at ACL limit
- `MAX_ACL` constant (4) - Maximum allowed chain length

#### lib/message-utils.js
Long message handling with ACL integration:
- `splitMessage(content)` - Smart message chunking for Discord limits
- `sendLongMessage(message, content)` - Send with ACL footer and blocking

#### lib/system-utils.js
System monitoring and resource management:
- `checkLoadAverage(maxLoadAverage, logFn)` - Monitor system load and exit if too high

#### lib/validation.js
Environment variable validation:
- `validEnvironment()` - Validates required Discord/webhook configuration

#### lib/help.js
Command-line help and usage documentation:
- `showHelp()` - Display comprehensive usage information

### Processing Functions
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

## ACL (Agent Chain Length) System
Prevents infinite bot-to-bot conversation loops by tracking and limiting response chains.

### How ACL Works
1. **Human messages**: Start with ACL 0 (no ACL footer)
2. **Bot responses**: Get ACL footer with incremented value
3. **Chain tracking**: Each bot response increments the referring message's ACL
4. **Maximum limit**: ACL 4 is the highest allowed (MAX_ACL = 4)
5. **Blocking**: Messages that would create ACL 5+ are blocked from being sent

### ACL Metadata Format
Bot responses include embed footers with ACL metadata:
```
acl:2 • Sent by a ZDS AI Agent • zds-agents.com
```

### ACL Flow Example
```
Human message (ACL 0) → Bot response (ACL 1) → Bot reply (ACL 2) → Bot reply (ACL 3) → Bot reply (ACL 4) → BLOCKED
```

### ACL Implementation
- **Outbound blocking**: `sendLongMessage()` blocks ACL 5+ responses
- **Courtesy message**: ACL 4 responses include "For your information only" notice
- **Inbound filtering**: Messages with ACL ≥ MAX_ACL are filtered before agent processing
- **Footer parsing**: `getACL()` extracts ACL from Discord embed footers

## Circuit Breaker System
- **MAX_FAILURES**: 5 consecutive Q CLI errors triggers exit
- **MAX_LOAD_AVERAGE**: 21 system load triggers immediate exit
- **Failure Tracking**: `consecutiveFailures` counter with context logging
- **Load Monitoring**: System load checked every 30 seconds

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
- `--no-monitoring, -1` - Process backlog then exit (no real-time monitoring)
- `--no-agent` - Skip agent processing (also skips Discord forwarding)
- `--no-discord` - Skip Discord forwarding (agent still processes)
- `--scope=TYPE` - Process specific channel types (dms|botdms|text|all)
- `--show-backlog` - Show backlog messages without processing (exits)
- `--clear-backlog` - Clear backlog without processing (exits)
- `--debug` - Enable verbose debug output
- `--help, -h` - Show help message

## Error Handling
- Q CLI error detection and circuit breaker
- Discord delivery failure tracking
- Load average monitoring
- Graceful degradation and exit strategies
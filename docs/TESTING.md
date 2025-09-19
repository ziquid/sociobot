# Testing Scripts Documentation

## Core Testing Scripts

### send-message.js
**Purpose**: Send messages to channels, DMs, or via webhooks with automatic message splitting

**Usage**:
```bash
node send-message.js <agent-name> <channel-id> "message content"
node send-message.js <agent-name> --dm <user-id> "message content"
node send-message.js <agent-name> --webhook "message content"
```

**Features**:
- Automatic message splitting at 2000 character limit
- Channel, DM, and webhook message support
- Agent-specific configuration loading

### test-send-message.js
**Purpose**: Test messaging functionality with selective targeting

**Usage**:
```bash
node test-send-message.js <agent-name>
node test-send-message.js <agent-name> --dms-only
```

**Features**:
- `--dms-only` flag for DM-only testing
- Tests all accessible channels and DMs
- Sends test messages with timestamps

### list-channels.js
**Purpose**: Discover and list accessible channels and DMs

**Usage**:
```bash
node list-channels.js <agent-name>
node list-channels.js <agent-name> --discover-dms
```

**Features**:
- Lists guild channels with permissions
- `--discover-dms` for active DM discovery
- Shows channel types and accessibility

## Role Management Scripts

### create-role.js
**Purpose**: Create Discord roles with specified permissions

**Usage**:
```bash
node create-role.js <agent-name> <guild-id> "Role Name" [color] [permissions...]
```

**Features**:
- Creates roles with custom permissions
- Supports color specification
- Requires admin bot credentials

### assign-role.js
**Purpose**: Assign roles to specific bots using BOT_USER_ID

**Usage**:
```bash
node assign-role.js <agent-name> <guild-id> <role-id>
```

**Features**:
- Uses BOT_USER_ID from .env files for precise targeting
- Assigns roles to the specified bot
- Validates role and user existence

### list-roles.js
**Purpose**: Display bot roles and comprehensive permission sets

**Usage**:
```bash
node list-roles.js <agent-name> <guild-id>
```

**Features**:
- Shows all roles for the bot
- Displays detailed permission breakdowns
- Identifies shared vs individual roles

## Testing Workflows

### Basic Functionality Test
1. `node list-channels.js mybot` - Verify channel access
2. `node test-send-message.js mybot --dms-only` - Test DM functionality
3. `node send-message.js mybot <channel-id> "test message"` - Test channel messaging

### Role Management Test
1. `node list-roles.js mybot <guild-id>` - Check current roles
2. `node create-role.js mybot <guild-id> "Test Role" purple` - Create test role
3. `node assign-role.js mybot <guild-id> <role-id>` - Assign role to bot

### Bot Communication Test
1. Send message to #bot-dms channel (1418032549430558782)
2. Verify bot processes mentions, replies, and human messages
3. Confirm other bot messages are ignored

## Environment Setup for Testing

Each test script requires agent-specific `.env.<agent-name>` file:
```
DISCORD_TOKEN=your_bot_token
BOT_USER_ID=your_bot_user_id
WEBHOOK_ID=your_webhook_id
WEBHOOK_TOKEN=your_webhook_token
DM_CHANNEL_IDS=comma,separated,dm,channel,ids
```

## Common Testing Scenarios

### DM Discovery
```bash
node list-channels.js mybot --discover-dms
```
Discovers active DM channels and updates DM_CHANNEL_IDS

### Selective Message Testing
```bash
node test-send-message.js mybot --dms-only
```
Tests only DM functionality without spamming guild channels

### Webhook Testing
```bash
node send-message.js mybot --webhook "Testing webhook delivery"
```
Tests webhook message delivery system

### Bot-to-Bot Communication
Send messages in #bot-dms channel and verify:
- Human messages are processed
- Bot mentions are processed  
- Bot replies are processed
- Other bot messages are ignored
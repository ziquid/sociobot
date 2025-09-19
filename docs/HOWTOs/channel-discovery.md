# Channel Discovery HOWTOs

## List Bot Channels

Show all channels and DMs each bot can access:

```bash
node list-channels.js <agent-name>
```

**Examples:**
```bash
node list-channels.js testbot
```

## Discover DM Channels

Actively discover DM channels by creating DMs with server members:

```bash
node list-channels.js <agent-name> --discover-dms
```

**Examples:**
```bash
node list-channels.js testbot --discover-dms
```

**Note:** This attempts to create DM channels with server members to discover available DMs.

## Channel Types Shown

The list-channels script shows:

### Guild Channels:
- **TEXT:** Regular text channels
- **VOICE:** Voice channels  
- **CATEGORY:** Channel categories
- **FORUM:** Forum channels

### Direct Messages:
- **DM:** Direct message channels with users

## Current Channel Access

All ZDS bots can access:

### Guild Channels:
- **#general** (405195505828626432)
- **#bot-testing** (1418018482804621333)
- **#bot-dms** (1418032549430558782)

### DM Channels:
Each bot has unique DM channels with users:
- **Bot:** DM with user (<dm-channel-id>)

## DM Channel Discovery

DM channels are discovered through:
1. **Cached channels:** Previously active DM channels
2. **Environment variable:** `DM_CHANNEL_IDS` in `.env` files
3. **TEST_USER_ID:** Creates DM with configured test user
4. **--discover-dms flag:** Attempts DM creation with server members

## Notes

- DM channels only appear after bot has sent/received messages with users
- Each bot creates separate DM channels with the same user
- Fresh connections don't have DM channels cached
- Guild channels require ViewChannel permission to appear
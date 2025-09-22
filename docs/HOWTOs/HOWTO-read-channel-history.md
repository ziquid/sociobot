# How to Read Channel History

## Quick Reference

```bash
# Read last 50 messages from a channel
node download-channel-history.js <bot-name> <channel-id> --limit 50

# Read last 100 DM messages
node download-channel-history.js brooke 1416514401350979636 --limit 100

# Get different output formats
node download-channel-history.js alex <channel-id> --limit 25 --format text
node download-channel-history.js alex <channel-id> --limit 25 --format markdown
```

## Step by Step

1. **Find your channel ID**
   ```bash
   node list-channels.js <bot-name>
   ```

2. **Download messages**
   ```bash
   node download-channel-history.js <bot-name> <channel-id> --limit <number>
   ```

3. **Read the output file**
   - Files are saved as: `<channel-name>_<date>.txt` (or .json/.md)
   - Location: current directory

## Examples

```bash
# Last 20 messages from bot-testing
node download-channel-history.js alex 1418018482804621333 --limit 20

# Last 50 DMs with user
node download-channel-history.js brooke 1416514401350979636 --limit 50

# Export as markdown
node download-channel-history.js alex 1418018482804621333 --limit 30 --format markdown
```

## Output Formats

- **text** (default): Simple timestamp + username + message
- **json**: Full message objects with metadata
- **markdown**: Formatted for documentation

## Tips

- Use `--limit` to control how many messages (default: 1000)
- Channel IDs are the long numbers from `list-channels.js`
- DM channels show as "DM: username (channel-id)"
- Files are automatically named with channel and date
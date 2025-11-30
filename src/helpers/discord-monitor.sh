#!/bin/bash

# Simple Discord Monitor
# Shows recent messages from key channels

echo "🔍 Discord Monitor - Recent Messages"
echo "===================================="
echo

GENERAL_CHANNEL="405195505828626432"
BOT_TESTING_CHANNEL="1416478751881166859"

echo "📢 General Channel (last 5 messages):"
echo "-------------------------------------"

# Use the discord_read_messages MCP tool directly
q chat test-agent --no-interactive --trust-all-tools "Use discord_read_messages with channelId $GENERAL_CHANNEL and limit 5. For each message, show: [TIME] AUTHOR: CONTENT (format timestamp as HH:MM, truncate long messages)" 2>/dev/null | \
sed -n '/^>/,$p' | \
sed 's/^> *//' | \
head -20

echo
echo "📢 Bot Testing Channel (last 3 messages):"
echo "------------------------------------------"

q chat test-agent --no-interactive --trust-all-tools "Use discord_read_messages with channelId $BOT_TESTING_CHANNEL and limit 3. For each message, show: [TIME] AUTHOR: CONTENT (format timestamp as HH:MM, truncate long messages)" 2>/dev/null | \
sed -n '/^>/,$p' | \
sed 's/^> *//' | \
head -20

echo
echo "💡 Read-only monitoring - Discord bot handles responses"

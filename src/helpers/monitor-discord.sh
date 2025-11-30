#!/bin/bash

# Discord Monitor Script for ZDS AI Agents
# Allows monitoring Discord messages from Q CLI without responding

echo "🔍 Discord Message Monitor"
echo "=========================="
echo

# Key channel IDs
GENERAL_CHANNEL="405195505828626432"
BOT_TESTING_CHANNEL="1416478751881166859"
AGENT_DM_CHANNEL=""  # Add if needed

# Function to format timestamp
format_time() {
    if command -v gdate >/dev/null 2>&1; then
        # macOS with GNU coreutils
        gdate -d "$1" "+%H:%M:%S"
    else
        # Try standard date
        date -j -f "%Y-%m-%dT%H:%M:%S" "${1%.*}" "+%H:%M:%S" 2>/dev/null || echo "??:??:??"
    fi
}

# Function to read and display messages from a channel
monitor_channel() {
    local channel_id=$1
    local channel_name=$2
    local limit=${3:-10}
    
    echo "📢 $channel_name (last $limit messages):"
    echo "----------------------------------------"
    
    # Use Q CLI with Discord MCP to read messages
    q chat --agent test-agent --no-interactive --trust-all-tools "Use discord_read_messages tool to get the last $limit messages from channel $channel_id. Format each message as: [TIME] USERNAME: MESSAGE" 2>/dev/null | \
    grep -E "^\[.*\].*:" | \
    tail -$limit
    
    echo
}

# Monitor key channels
echo "Monitoring Discord channels..."
echo

monitor_channel "$GENERAL_CHANNEL" "General" 5
monitor_channel "$BOT_TESTING_CHANNEL" "Bot Testing" 5

# If monitoring DMs is needed, uncomment:
# if [ -n "$AGENT_DM_CHANNEL" ]; then
#     monitor_channel "$AGENT_DM_CHANNEL" "Agent DMs" 3
# fi

echo "✅ Monitor complete. Run this script again to refresh."
echo "💡 Tip: You can only view messages, not respond. The Discord bot handles responses."

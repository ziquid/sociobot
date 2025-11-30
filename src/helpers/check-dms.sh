#!/bin/bash

# Check DMs for each agent
# Usage: ./check-dms.sh [agent_name] [port]

AGENT=${1:-test-agent}
PORT=${2:-3001}

if [ -z "$AGENT" ]; then
  echo "Usage: $0 <agent-name> [port]"
  echo "Example: $0 test-agent 3001"
  exit 1
fi

echo "🔍 Checking DMs for $AGENT..."
echo "================================"

curl -s "http://localhost:$PORT/dms" | jq -r '.messages[] | "[\(.timestamp)] \(.author): \(.content)"' 2>/dev/null || echo "DM monitoring not available (bot may need restart)"

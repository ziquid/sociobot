#!/bin/bash

# Check DMs for each agent
# Usage: ./check-dms.sh [agent_name]

AGENT=${1:-brooke}

case $AGENT in
  "devon")
    PORT=3001
    ;;
  "brooke") 
    PORT=3002
    ;;
  "harriet")
    PORT=3003
    ;;
  *)
    echo "Usage: $0 [devon|brooke|harriet]"
    exit 1
    ;;
esac

echo "🔍 Checking DMs for $AGENT..."
echo "================================"

curl -s "http://localhost:$PORT/dms" | jq -r '.messages[] | "[\(.timestamp)] \(.author): \(.content)"' 2>/dev/null || echo "DM monitoring not available (bot may need restart)"

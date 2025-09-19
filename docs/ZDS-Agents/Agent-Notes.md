# ZDS Agent Development Notes

## Key Lessons Learned

### Command Efficiency
- **NEVER grep through node_modules** - use `--exclude-dir=node_modules` or limit searches to project files only
- Large command outputs can fill context windows and force history compaction
- Be precise with search scope to preserve valuable conversation context

## Recent Changes Made

### Bot Message Handling
- Created `handleLowPriorityMessage()` function with configurable delay (BOT_MESSAGE_DELAY env var, default 17s)
- Bot messages now get delayed processing to prevent immediate bot-to-bot interactions
- Updated messageCreate handler to route bot messages through low priority handler

### File Organization
- Moved `last_processed_*.json` files to `data/persistence/` with `.gitignore`
- Created `data/logs/` directory for all log files with `.gitignore`
- Updated `botctl` script to place logs in `data/logs/`
- Updated `qcli.js` interaction logging to use `data/logs/`
- Moved all documentation to `docs/` directory

### Logging Improvements
- Truncated message content in logs to first 300 characters to prevent log spam
- All file logging now organized under `data/` directory structure

## Project Structure
```
data/
├── logs/           # Bot and interaction logs (.gitignore: *.log)
└── persistence/    # Runtime state files (.gitignore: *.json)
docs/               # All documentation
└── ZDS-Agents/     # Agent-specific notes
```

## Environment Variables
- `BOT_MESSAGE_DELAY`: Milliseconds to delay bot message processing (default: 17000)
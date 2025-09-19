# ZDS Agent Development Notes

## Key Lessons Learned

### CRITICAL: Search Documentation First
- **NEVER guess API options or library behavior**
- **ALWAYS search for official documentation when encountering unknown APIs**
- Example: dotenv console output suppression → search "dotenv suppress console output" → find `quiet: true` option
- Guessing wastes time and creates frustration
- Documentation search should be the FIRST step, not the last resort

### Command Efficiency
- **NEVER grep through node_modules** - use `--exclude-dir=node_modules` or limit searches to project files only
- Large command outputs can fill context windows and force history compaction
- Be precise with search scope to preserve valuable conversation context

### Bot Management
- botctl doesn't support individual bot stops - must stop all bots
- Use botctl commands, don't bypass with pkill or other tools
- Order matters: stop → remove from config → restart, not stop → restart → remove
- Environment variables follow pattern: DISCORD_TOKEN, WEBHOOK_ID, WEBHOOK_TOKEN
- Agent-to-bot mapping stored in ~/.config/zai/*agents directory

### Discord API
- Bot application info: `curl -s -H "Authorization: Bot $DISCORD_TOKEN" https://discord.com/api/v10/applications/@me | jq -r '.name'`
- Webhook info: `curl -s https://discord.com/api/v10/webhooks/$WEBHOOK_ID/$WEBHOOK_TOKEN`
- Must source .env file before using variables: `source .env.<bot-name> &&`

### Validation Process
- Always validate agent name → bot name mapping before destructive actions
- Use `grep -rni "<agent-name>" ~/.config/zai/*agents` to find bot mapping
- Verify Discord resources match expected names, not just existence
- Authorization is part of verification, not a separate step

### API Management
- Never read large API responses into context - pipe directly to processing tools
- Use `curl -s` to suppress progress output in scripts
- Extract only needed data with tools like `jq -r '.fieldname'`
- Source environment files before using variables in commands

### File Operations
- Use process ID (`$$`) for unique temporary file names
- Don't create unnecessary temporary files when piping works
- Follow established naming conventions for config files

### Documentation Structure
- Use consistent numbering schemes (1.1.1.1 format)
- Separate "affected resources" from "desired outcomes"
- Include actual commands in process steps, not just descriptions
- Validation steps should come before destructive actions

### Command Design
- Don't include redundant status checks (obvious outcomes)
- Use provided tools rather than bypassing with lower-level commands
- Order of operations matters - think through dependencies
- Be specific about what information is needed vs nice-to-have
- Never hardcode bot names - use variables and parameters
- Use existing working patterns instead of inventing new approaches

### Code Quality Standards
- **NEVER overwrite existing files without explicit permission** - always check if files exist first
- When asked for specific output format (like diffs), provide exactly what was requested
- When asked to show "why" something happens, provide specific reasons, not just boolean flags
- Don't make users repeat requests - understand requirements fully the first time
- Be honest about mistakes - don't minimize errors by saying "almost" when you actually did something wrong

### Error Prevention
- Validate all inputs before proceeding with changes
- Have clear rollback procedures
- Test commands on known-good data first
- Use explicit variable names that match the actual config

## Recent Changes Made

### Command-Line Flag System Redesign
- Restructured flags into logical categories: Execution Phases, Processing Pipeline, Scope Filters, Debugging, Help
- Replaced `--dms-only` with granular `--scope=TYPE` system supporting dms, botdms, text, all
- Added stackable scopes with comma separation: `--scope=dms,botdms`
- Implemented processing pipeline breakpoints: `--no-agent`, `--no-discord`
- Added `--show-backlog` and `--clear-backlog` for backlog management
- Standardized `--debug` flag for verbose output without affecting processing flow

### Debug Output Enhancements
- Removed milliseconds from all log timestamps for cleaner output
- Added routing debug information showing WHY messages are processed or skipped:
  - Backlog: "own bot message", "before cutoff", "will process"
  - Realtime: "mentioned bot", "direct message", "has view permission", "no routing criteria met"
- Bot ID verification only shows in debug mode
- Channel name resolution in debug output instead of just IDs

### Processing Architecture
- Established three-step processing pipeline: 1) Fetch messages, 2) Send to agents, 3) Forward to Discord
- Clear breakpoint controls at each step with appropriate flag combinations
- `--no-agent` implies skipping Discord forwarding (no responses to forward)
- Scope filtering works independently of processing steps

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
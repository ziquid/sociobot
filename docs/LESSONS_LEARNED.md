# Lessons Learned

## Project-Specific Lessons (ZDS Discord Bot Management)

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

## Universal Lessons (Any Project)

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

### Error Prevention
- Validate all inputs before proceeding with changes
- Have clear rollback procedures
- Test commands on known-good data first
- Use explicit variable names that match the actual config
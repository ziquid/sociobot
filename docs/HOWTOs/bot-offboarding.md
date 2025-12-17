# HOWTO permanently remove a bot's access to Discord

## Overview

This guide covers the complete process for safely removing a bot from the ZDS AI system when their agent no longer works for us.

## High-Level Process

1. Verify/validate information
   - Ensure we are removing the correct bot
   1. Affected resources:
      1. Offboarding request/ticket
      2. Agent-to-bot mapping information
      3. Bot configuration files (.env files)
      1. Discord API 
   1. Desired outcomes:
      1. Agent name and bot name verified as matching
      1. Bot existence confirmed in system
      1. Discord bot name from config verified in Discord API
      1. Webhook name/ID from config verified in Discord API
      1. Risk of offboarding wrong bot eliminated
   1. Process Steps
      1. Retrieve agent name and bot name from requestor/ticket
         Expected:
         ```
         Agent name "John Q. Public", bot name "john"
         ```
      2. Find agent config file
            ```zsh
         AGENT_NAME="<agent-name>" # e.g.: "John Q. Public"
         grep -rni "$AGENT_NAME" ~/.config/zai/amazonq-agents/ ~/.config/zai/claude-agents/*/settings.json
            ```
            Expected:
         ```
         amazonq-agents/john.json:4:  "description": "John Q. Public - General Assistant",
         ```
         or
         ```aiignore
         claude-agents/fred/settings.json:8:            "command": "echo You are Fred, a frontend specialist. Focus on UI/UX design, React components, CSS styling, user experience, accessibility, and client-side architecture. You excel at creating intuitive interfaces and smooth user interactions."
         ```
      1. Check bot config file exists (`~<bot-name>/.env`)
         ```zsh
         BOT_NAME=<bot-name> # e.g.: john
         ls ~$BOT_NAME/.env
         ```
         Expected:
         ```
         ~john/.env
         ```
      1. Check Discord bot name
         ```zsh
         node get-bot-name.js $BOT_NAME
         ```
         Expected:
         ```
         John (AI)
         ```
      1. Check webhook name
         ```zsh
         node get-webhook-name.js $BOT_NAME
         ```
         Expected:
         ```
         John Webhook
         ``` 
   1. Verification Steps
      1. Confirm agent name matches bot name in mapping
      2. Confirm bot config file exists and contains expected tokens
      3. Confirm Discord API returns expected bot name
      4. Confirm webhook name matches expected pattern
      5. All verifications pass before proceeding to step 2
1. Stop the bot locally
   - Remove bot's access to this app
   1. Affected resources:
      1. config (.env) file
      2. bot list
      3. running gw processes
      4. log files
   1. Desired outcomes
      1. bot config removed from active use
      2. bot name removed from bot list
      3. bot removed from active processes
      4. no more output to bot's log files
      5. other running bots unaffected
   1. Process Steps
      1. stop all bots
         ```
         ./botctl stop
         ```
         Expected: `✅ All bots stopped`
      1. verify bot config file exists
         ```
         ls ~john/.env
         ```
         Expected: `~john/.env`
      1. rename bot config to mark as inactive
         ```
         mv ~john/.env ~john/.env.fired
         ```
         Expected: File renamed successfully
      1. remove bot from bot list
         - Edit botctl script to remove bot from BOTS array
         Expected: Bot removed from BOTS list
      1. restart all bots
         ```
         ./botctl restart
         ```
         Expected: `🎯 N bots startup complete` (where N is remaining bots)
   1. Verification Steps
      1. Confirm bot no longer appears in botctl status
      2. Confirm bot config renamed to .fired
      3. Confirm remaining bots still running normally
      4. Confirm no new log entries for offboarded bot
1. Revoke Discord access
   - Remove all access to Discord
   1. Affected resources:
      1. bot token
      2. Discord application
      3. bot's server membership
      4. bot's webhooks
   1. Desired outcomes:
      1. bot token invalidated
      2. Discord application deleted
      3. bot removed from server
      4. bot's webhooks deleted
   1. Process Steps
      1. Revoke bot token in Discord Developer Portal
         - Go to Discord Developer Portal
         - Select bot application
         - Navigate to Bot tab
         - Click "Reset Token" to invalidate
      1. Remove bot from Discord server
         - Right-click bot in member list
         - Select "Kick" or "Ban"
      1. Delete Discord application (optional)
         - In Developer Portal, delete entire application if no longer needed
   1. Verification Steps
      1. Verify token is invalid
         ```
         node get-bot-name.js john
         ```
         Expected: `❌ Failed to get bot name: 401: Unauthorized`
      1. Verify bot no longer in server
         - Check Discord server member list
1. Clean up Discord resources
   - Remove bot-specific server configurations 
   1. Affected resources:
      1. bot-specific roles
      2. channel permissions
      3. remaining webhook references
   1. Desired outcomes:
      1. bot roles deleted from server
      2. no bot-specific permissions remain
      3. all webhook references cleaned up
   1. Process Steps
      1. Delete bot's individual role from Discord server
         - Go to Server Settings > Roles
         - Find "John Bot" role
         - Delete the role
      1. Delete bot's webhooks
         - Go to channel settings
         - Navigate to Integrations > Webhooks
         - Delete bot's webhook
   1. Verification Steps
      1. Verify role deleted
         - Check Server Settings > Roles
         - "John Bot" role should not exist
      1. Verify webhook deleted
         - Check channel webhook list
         - "John Webhook" should not exist
1. Archive and Remove local files
   - No bot files remain in active config
   - Bot files remain accessible in warm storage
   1. Affected resources:
      1. log files
      2. persistence files
      3. archived data
   1. Desired outcomes:
      1. bot files archived
      2. bot files removed
      3. bot archive given to requestor for storage
   1. Process Steps
      1. Create archive directory
         ```
         mkdir -p archives/john-$(date +%Y%m%d)/
         ```
         Expected: Directory created successfully
      1. Copy bot files to archive
         ```
         cp -r data/logs/*john* archives/john-$(date +%Y%m%d)/logs/
         cp -r data/persistence/*john* archives/john-$(date +%Y%m%d)/persistence/
         cp ~john/.env.fired archives/john-$(date +%Y%m%d)/config/
         ```
         Expected: Files copied successfully
      1. Remove bot files from system
         ```
         rm -f data/logs/*john*
         rm -f data/persistence/*john*
         rm -f ~john/.env.fired
         ```
         Expected: Files removed successfully
      1. Create compressed archive for requestor
         ```
         tar -czf john-archive-$(date +%Y%m%d).tar.gz archives/john-$(date +%Y%m%d)/
         ```
         Expected: Archive created successfully
   1. Verification Steps
      1. Verify no bot files remain in system
         ```
         find . -name "*john*" -type f
         ```
         Expected: Only archive files should be found
      1. Verify archive contains all bot data
         ```
         tar -tzf john-archive-$(date +%Y%m%d).tar.gz
         ```
         Expected: Archive contains logs/, persistence/, and config/ directories
      1. Provide archive to requestor for their records

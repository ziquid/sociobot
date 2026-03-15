# Sociobot Roadmap

## Version 0.1.3

### Technical Debt

- [  ] Convert helper scripts to TypeScript
   - [  ] create-webhooks.ts - Converted with dynamic agent discovery

- [  ] Add sb- prefix to helper bin entries
   - [  ] sb-create-webhooks - Installed as global command

- [✅] Refactor channel delay checking into separate function (#93)
   - Extracted inline delay logic into shouldDelayMessageSend() function
   - Enables future expansion of delay conditions without cluttering message handler

- [✅] Refactor shouldDelayMessageSend() to shouldSendMessage() with three-state return (#96)
   - [✅] Add MESSAGE_DONT_SEND, MESSAGE_SEND_LATER, MESSAGE_SEND_NOW constants
   - [✅] Implement message filtering for empty, NO_RESPONSE, and zero-width unicode messages
   - [✅] Update message handlers to use three-state logic

- [  ] Determine which helpers should become agent bins or admin bins or deleted
   - [  ] assign-role.js (admin/agent/delete)
   - [  ] check-dms.sh (admin/agent/delete)
   - [  ] check-webhooks.js (admin/agent/delete)
   - [  ] create-channel.js (admin/agent/delete)
   - [  ] create-role.js (admin/agent/delete)
   - [  ] discord-monitor.sh (admin/agent/delete)
   - [  ] discord-peek.js (admin/agent/delete)
   - [  ] fix-webhooks.js (admin/agent/delete)
   - [  ] get-bot-name.js (admin/agent/delete)
   - [  ] get-webhook-name.js (admin/agent/delete)
   - [  ] list-roles.js (admin/agent/delete)
   - [  ] monitor-discord.sh (admin/agent/delete)
   - [  ] show-channel.js (admin/agent/delete)
   - [  ] show-message.js (admin/agent/delete)

### New Functionality

- [✅] botctl monitor midnight restart (#61)
- [  ] Add SKILLZ man pages for binaries
   - [  ] Agent binaries
      - [  ] sb-download-channel-history
      - [  ] sb-list-channels
      - [  ] sb-send-message
   - [  ] Admin binaries
      - [  ] botctl
      - [  ] sociobot
      - [  ] sb-create-webhooks
- [✅] Add GEMINI_API_KEY and ZDS_AI_FLASH_MODELS to list of env vars to provide to each bot
- [✅] Send all ZDS_AI_ env vars to speech encoder and zai-cli, not just ZDS_AI_AGENT_ vars
- [✅] Add channel name support to download-channel-history (#101)
   - Added resolveChannelId() function to accept both numeric IDs and channel names
   - Searches all guilds with proper permission checks
   - Handles ambiguous names and shows available channels
- [✅] Turned off Discord emoji reaction notifications pending feature/86
- [🔘] Properly mark discord emoji reaction notifications (feature/86)

### Bugs Fixed

- [✅] boctl check for sudo was incorrect
- [✅] cd to agent home before running any bots
- [✅] Linux load averages had a trailing comma
- [✅] qcli forwarding empty responses to Discord after stripping think tags (#70)
- [✅] Double ACL limits for thread participants (#71)
- [✅] DM channel name showing "undefined" when recipient.username is null (#72)
- [✅] botctl bad pattern error in help message (#77)
- [✅] Triple ACL for agents mentioned or message authors (#80)
- [✅] Fix botctl monitor persistence in Linux containers (#82)
   - Made setsid conditional based on container detection
   - Uses setsid in containers (/.dockerenv or /run/.containerenv)
   - Falls back to nohup on Mac/non-container environments
- [✅] Fix botctl mon not monitoring or restarting mailbots (#91)
   - Added check_and_restart_mailbot() function
   - monitor_loop() now checks both SOCIOBOT_BOTS and MAILBOT_BOTS separately
- [✅] Update discord.js ready event to clientReady (#63)
   - Replaced deprecated 'ready' event with 'clientReady' in helper scripts
   - Eliminates deprecation warning in stderr
- [✅] `noDiscord` flag was not being properly recognized when processing messages.

# Sociobot Roadmap

## Version 0.1.2

### Technical Debt

- [✅] Remove obsolete 'old' subdirectory
   - [✅] Delete old/entrypoint.sh and old/index.js
- [✅] Add TypeScript build infrastructure
   - [✅] Create tsconfig.json with proper ES2022 config
   - [✅] Add TypeScript and @types/node as dev dependencies
   - [✅] Replace build stub with proper 'tsc' build script
   - [✅] Add 'clean' script to remove dist directory
- [🔘] Convert helper scripts to TypeScript
   - [✅] send-message.js
   - [✅] download-channel-history.js
   - [✅] list-channels.js
   - [✅] create-webhooks.js
- [🔘] Add sb- prefix to helper bin entries
   - [✅] sb-send-message
   - [✅] sb-download-channel-history
   - [✅] sb-list-channels
   - [✅] sb-create-webhooks
- [🔘] Enable botctl sudo for per-agent user accounts on host
   - [  ] *Except* `bot`
- [✅] Scope package as @zds-ai/sociobot
- [✅] Enable `sb-create-webhooks` to discover all agents with sociobot profiles automatically

### New Functionality

- [  ] Add support for SYNTHETIC_API_KEY and OLLAMA_HOST vars


## Version 0.1.3

### Technical Debt

- [  ] Convert helper scripts to TypeScript
   - [  ] list goes here

- [  ] Add sb- prefix to helper bin entries
   - [  ] list goes here

### New Functionality

- [  ] Add SKILLS for helper scripts
   - [  ] list goes here

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
   - [  ] more...
- [🔘] Add sb- prefix to helper bin entries
   - [✅] sb-send-message
   - [✅] sb-download-channel-history
   - [✅] sb-list-channels
   - [  ] more...
- [✅] Enable botctl sudo for per-agent user accounts on host
- [  ] Scope package as @zds-ai/sociobot

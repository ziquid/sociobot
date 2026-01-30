# Sociobot Roadmap

## Version 0.1.3

### Technical Debt

- [  ] Convert helper scripts to TypeScript
   - [x] create-webhooks.ts - Converted with dynamic agent discovery

- [  ] Add sb- prefix to helper bin entries
   - [x] sb-create-webhooks - Installed as global command

### New Functionality

- [✅] botctl monitor midnight restart (#61)
- [  ] Add SKILLS for helper scripts
   - [  ] list goes here

### Bugs Fixed

- [✅] boctl check for sudo was incorrect
- [✅] cd to agent home before running any bots
- [✅] Linux load averages had a trailing comma
- [✅] qcli forwarding empty responses to Discord after stripping think tags (#70)
- [✅] Double ACL limits for thread participants (#71)
- [✅] DM channel name showing "undefined" when recipient.username is null (#72)
- [✅] botctl bad pattern error in help message (#77)
- [✅] Triple ACL for agents mentioned or message authors (#80)

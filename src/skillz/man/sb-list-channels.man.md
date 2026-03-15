---
name: sb-list-channels
purpose: display all discord channels accessible to the agent
invocation: sb-list-channels [<options>]
audience: agents
relevance: when using discord
---

# sb-list-channels

Display all Discord channels accessible to the agent.

## USAGE

`sb-list-channels [<options>]`

## OPTIONS

- `--discover-dms`: Attempt to discover DM channels
- `--debug`: Show debug information 
- `--help, -h`: Show a help message

## EXAMPLES

1. `sb-list-channels`
1. `sb-list-channels --discover-dms`
1. `sb-list-channels --debug`

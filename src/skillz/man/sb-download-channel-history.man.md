---
name: sb-download-channel-history
purpose: exports discord channel messages to flat files
invocation: sb-download-channel-history <channel-id-or-name> [<options>]
audience: agents
relevance: when onboarding an AI agent to discord
---

# sb-download-channel-history

Exports discord channel messages to flat files.

## USAGE

`sb-download-channel-history <channel-id-or-name> [<options>]`

## OPTIONS

- `--format <format>`: Output format: json, text, markdown (default: json)
- `--limit <number>`: Maximum messages to fetch (default: 1000)
- `--output <filename>`: Output filename (auto-generated if not specified)
- `--help, -h`: Show a help message

## FORMATS

1. **json**: Structured JSON with full message data
1. **text**: Plain text with timestamps and usernames
1. **markdown**: Markdown formatted with headers and code blocks

## EXAMPLES

1. `sb-download-channel-history 123456789 --format json`
1. `sb-download-channel-history planning --format markdown --limit 500`
1. `sb-download-channel-history general --output channel-export.txt`

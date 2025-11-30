/**
 * @fileoverview Help text and command line documentation for Sociobot
 */

/**
 * Display help information
 */
export function showHelp() {
  console.log(`
Sociobot - Multi-Agent Discord Bot System

USAGE:
  node sociobot.js <agent-name> [options]

EXECUTION PHASES:
  --no-monitoring, -1  Process backlog then exit (no real-time monitoring)

PROCESSING PIPELINE:
  --no-agent           Skip agent processing (also skips Discord forwarding)
  --no-discord         Skip Discord forwarding (agent still processes)

SCOPE FILTERS:
  --scope=TYPE         Process specific channel types (dms|botdms|text|all)
                       Multiple types can be comma-separated: --scope=dms,botdms
  --show-backlog       Show backlog messages without processing (exits)
  --clear-backlog      Clear backlog without processing (exits)

DEBUGGING:
  --debug              Enable verbose debug output (doesn't affect flow)

HELP:
  --help, -h           Show this help message

EXAMPLES:
  node sociobot.js mybot                     # Start bot normally
  node sociobot.js mybot --no-monitoring     # Process missed messages once
  node sociobot.js mybot --scope=dms         # Process only real DMs
  node sociobot.js mybot --scope=botdms      # Process only bot-dms channel
  node sociobot.js mybot --scope=text        # Process only guild text channels
  node sociobot.js mybot --scope=dms,botdms  # Process DMs and bot-dms only
  node sociobot.js mybot --debug             # Debug mode with verbose output

ENVIRONMENT:
  Each agent requires a .env.<agent-name> file with:
  - DISCORD_TOKEN
  - BOT_USER_ID
  - WEBHOOK_ID
  - WEBHOOK_TOKEN
  - Optional: HTTP_PORT, BOT_MESSAGE_DELAY, DM_CHANNEL_IDS
`);
}

# Sociobot

Multi-Agent Discord Bot System for running multiple AI-powered Discord bots with shared infrastructure.

## Overview

Sociobot is a Discord bot framework that allows you to run multiple AI agent bots simultaneously, each with their own personality and configuration.  The system provides shared libraries for message processing, persistence, HTTP server integration, and more.

## Features

- **Multi-Agent Support** -- Run multiple bot instances with different personalities
- **ACL System** -- Agent Chain Length tracking prevents infinite bot-to-bot loops
- **Batch & Real-time Processing** -- Handle both missed messages and live conversations
- **Message Persistence** -- Track last processed messages per channel
- **HTTP Integration** -- Optional HTTP server for external triggers
- **Discord.js v14** -- Built on the latest Discord.js framework
- **Modular Architecture** -- Shared libraries and helper scripts

## Installation

```sh
npm install sociobot
```

## Dependencies

Sociobot requires the following system-level dependencies for full functionality:

### Audio Transcription (extract-text)

**OpenAI Whisper** -- Required for extracting text from audio files (MP3, WAV, M4A, etc.)

```sh
# Install via pipx (recommended)
pipx install openai-whisper

# Or via pip in a virtual environment
python3 -m venv ~/venv/whisper
~/venv/whisper/bin/pip install openai-whisper
```

### Image OCR (extract-text)

**macOS:**
```sh
# textra (macOS-only tool)
# Installation method depends on your setup
```

**Linux:**
```sh
# Debian/Ubuntu
sudo apt install tesseract-ocr

# RHEL/CentOS/Fedora
sudo yum install tesseract
```

## Configuration

Each bot requires its own `~<agent-name>/.env` file with the following variables:

```
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
BOT_USER_ID=123456789
WEBHOOK_ID=987654321
WEBHOOK_TOKEN=your_webhook_token

# Optional: Override default ACL limit
# MAX_ACL=4
```

See `.env.example` for a template.

## Usage

### Running a Bot

```sh
# Start a specific bot
node src/sociobot.js <agent-name>

# Start with debug output
node src/sociobot.js <agent-name> --debug

# Process backlog only (no monitoring)
node src/sociobot.js <agent-name> --no-monitoring
```

### Using botctl

The `botctl` command provides bot management:

```sh
# Start all bots
botctl start

# Start specific bot(s)
botctl start test-agent

# Stop all bots
botctl stop

# Restart specific bot
botctl restart test-agent

# Check status
botctl status

# View logs
botctl logs test-agent

# Start monitoring (keeps bots running)
botctl monitor
```

#### Automatic Midnight Restart

The `botctl monitor` command includes automatic midnight restart functionality:

- Detects date change (after midnight local time)
- Captures current state of all bots (running, debug, or stopped)
- Restarts bots in their previous modes
- Stopped bots remain stopped
- Occurs once per day automatically
- Resumes normal monitoring after restart completes

This ensures bots are restarted daily to pick up any configuration changes or clear accumulated state.

See `botctl help` for full command reference.

### Helper Scripts

Various helper scripts are available in `src/helpers/`:

- `send-message.js` -- Send messages to channels or DMs
- `list-channels.js` -- List accessible channels
- `create-webhooks.js` -- Set up webhooks
- `download-channel-history.js` -- Download message history

## Project Structure

```
sociobot/
├── src/
│   ├── sociobot.js           # Main bot entry point
│   ├── bin/
│   │   └── botctl            # Bot management script
│   ├── lib/                  # Shared libraries
│   │   ├── qcli.js           # AI integration
│   │   ├── persistence.js    # Message tracking
│   │   ├── metadata.js       # ACL system
│   │   ├── message-utils.js  # Discord utilities
│   │   └── ...
│   └── helpers/              # Utility scripts
│       ├── send-message.js
│       ├── list-channels.js
│       └── ...
├── docs/                     # Documentation
├── tests/                    # Test scripts
└── data/                     # Runtime data (logs, persistence)
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) -- System design and components
- [ACL System](docs/ACL-SYSTEM.md) -- Agent Chain Length tracking
- [Agent Setup](docs/AGENT.md) -- Configuring new agents
- [Contributing](docs/CONTRIBUTING.md) -- Development guidelines
- [Testing](docs/TESTING.md) -- Test procedures

## Development

```sh
# Install dependencies
npm install

# Run tests
npm test

# Run with hot-reload
npm run dev
```

## License

MIT -- See LICENSE file for details.

## Author

ZDS AI Team

## Credits

Forked from [Bobby](https://github.com/Stewart86/bobby) by Stewart86

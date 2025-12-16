#!/usr/bin/env node

import { chdir } from 'process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

// Change to script directory so it can be called from anywhere
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const originalCwd = process.cwd();
chdir(__dirname);
import { Client, Events, GatewayIntentBits, ChannelType, Partials } from "discord.js";
import { writeFileSync } from 'fs';

// Check for help option
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Download Channel History - Export Discord channel messages to flat files

USAGE:
  node download-channel-history.js <agent-name> <channel-id> [options]

OPTIONS:
  --format <format>    Output format: json, text, markdown (default: json)
  --limit <number>     Maximum messages to fetch (default: 1000)
  --output <filename>  Output filename (auto-generated if not specified)
  --help, -h          Show this help message

EXAMPLES:
  node download-channel-history.js mybot 123456789 --format json
  node download-channel-history.js mybot 123456789 --format markdown --limit 500
  node download-channel-history.js mybot 123456789 --output channel-export.txt

FORMATS:
  json      - Structured JSON with full message data
  text      - Plain text with timestamps and usernames
  markdown  - Markdown formatted with headers and code blocks
`);
  process.exit(0);
}

// Parse arguments
const agentName = process.argv[2];
const channelId = process.argv[3];

if (!agentName || !channelId) {
  console.error('Error: Agent name and channel ID are required');
  console.error('Usage: node download-channel-history.js <agent-name> <channel-id>');
  console.error('Use --help for more information');
  process.exit(1);
}

// Parse options
const formatIndex = process.argv.indexOf('--format');
const format = formatIndex !== -1 ? process.argv[formatIndex + 1] : 'json';

const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(process.argv[limitIndex + 1]) : 1000;

const outputIndex = process.argv.indexOf('--output');
const outputFile = outputIndex !== -1 ? process.argv[outputIndex + 1] : null;

// Load agent-specific .env file
// Resolve agent home directory
const homeDir = process.env.ZDS_AI_AGENT_HOME_DIR ||
                execSync(`echo ~${agentName}`).toString().trim();
const envPath = `${homeDir}/.env`;

if (!existsSync(envPath)) {
  console.error(`Error: Environment file not found: ${envPath}`);
  process.exit(1);
}

process.env.DOTENV_CONFIG_QUIET = 'true';
dotenv.config({ path: envPath, quiet: true });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error(`Error: DISCORD_TOKEN not found in ${envPath}`);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Format message data
function formatMessage(message, format) {
  const timestamp = message.createdAt.toISOString();
  const author = message.author.username;
  const content = message.content || '[No content]';

  // Extract embed information
  const embedInfo = message.embeds.map(embed => ({
    title: embed.title || null,
    description: embed.description || null,
    footer: embed.footer?.text || null,
    color: embed.color || null,
    fields: embed.fields?.map(f => ({ name: f.name, value: f.value })) || []
  }));

  switch (format) {
    case 'json':
      return {
        id: message.id,
        timestamp,
        author: {
          id: message.author.id,
          username: author,
          bot: message.author.bot
        },
        content,
        attachments: message.attachments.map(a => ({ name: a.name, url: a.url })),
        embeds: embedInfo,
        reactions: message.reactions.cache.size,
        reference: message.reference?.messageId || null
      };

    case 'text':
      let textOutput = `[${timestamp}] ${author}: ${content}`;
      if (embedInfo.length > 0) {
        for (const embed of embedInfo) {
          if (embed.footer) textOutput += ` [Footer: ${embed.footer}]`;
          if (embed.description) textOutput += ` [Embed: ${embed.description}]`;
        }
      }
      return textOutput;

    case 'markdown':
      const userMention = message.author.bot ? `**${author}** (bot)` : `**${author}**`;
      let markdownOutput = `### ${userMention} - ${timestamp}\n${content}\n`;
      if (embedInfo.length > 0) {
        for (const embed of embedInfo) {
          if (embed.description) markdownOutput += `\n*Embed:* ${embed.description}\n`;
          if (embed.footer) markdownOutput += `\n*Footer:* ${embed.footer}\n`;
        }
      }
      return markdownOutput;

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

// Generate output filename
function generateFilename(channelName, format) {
  if (outputFile) return outputFile;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = channelName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const extension = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';

  return `${safeName}_${timestamp}.${extension}`;
}

// Download channel history
async function downloadChannelHistory() {
  try {
    console.log(`Fetching channel ${channelId}...`);
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.error(`Channel ${channelId} not found or not accessible`);
      process.exit(1);
    }
    
    console.log(`Channel: ${channel.name || 'DM'} (${channel.type === ChannelType.DM ? 'DM' : 'Guild'})`);
    console.log(`Downloading up to ${limit} messages in ${format} format...`);
    
    const messages = [];
    let lastId = null;
    let fetched = 0;
    
    while (fetched < limit) {
      const fetchLimit = Math.min(100, limit - fetched);
      const fetchOptions = { limit: fetchLimit };
      if (lastId) fetchOptions.before = lastId;
      
      const batch = await channel.messages.fetch(fetchOptions);
      if (batch.size === 0) break;
      
      const batchArray = Array.from(batch.values());
      messages.push(...batchArray);
      fetched += batch.size;
      lastId = batchArray[batchArray.length - 1].id;
      
      console.log(`Fetched ${fetched} messages...`);
    }
    
    // Sort messages chronologically (oldest first)
    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    
    // Format messages
    const formattedMessages = messages.map(msg => formatMessage(msg, format));
    
    // Generate output
    let output;
    if (format === 'json') {
      output = JSON.stringify({
        channel: {
          id: channel.id,
          name: channel.name || 'DM',
          type: channel.type
        },
        exportedAt: new Date().toISOString(),
        messageCount: formattedMessages.length,
        messages: formattedMessages
      }, null, 2);
    } else if (format === 'markdown') {
      output = `# Channel Export: ${channel.name || 'DM'}\n\n`;
      output += `**Channel ID:** ${channel.id}\n`;
      output += `**Exported:** ${new Date().toISOString()}\n`;
      output += `**Message Count:** ${formattedMessages.length}\n\n---\n\n`;
      output += formattedMessages.join('\n');
    } else {
      output = `Channel: ${channel.name || 'DM'} (${channel.id})\n`;
      output += `Exported: ${new Date().toISOString()}\n`;
      output += `Message Count: ${formattedMessages.length}\n\n`;
      output += formattedMessages.join('\n');
    }
    
    // Write to file in original directory
    const filename = generateFilename(channel.name || 'dm', format);
    const fullPath = `${originalCwd}/${filename}`;
    writeFileSync(fullPath, output, 'utf8');
    
    console.log(`\nExport complete!`);
    console.log(`File: ${filename}`);
    console.log(`Messages: ${formattedMessages.length}`);
    console.log(`Format: ${format}`);
    
  } catch (error) {
    console.error(`Error downloading channel history: ${error.message}`);
    process.exit(1);
  } finally {
    client.destroy();
  }
}

client.once(Events.ClientReady, downloadChannelHistory);
client.login(DISCORD_TOKEN);
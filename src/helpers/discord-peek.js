#!/usr/bin/env node

/**
 * Discord Peek Tool - Read-only Discord monitoring for ZDS AI agents
 * Usage: node discord-peek.js [channel] [limit]
 */

import { spawn } from 'child_process';

const CHANNELS = {
  'general': '405195505828626432',
  'bot-testing': '1416478751881166859',
  'testing': '1416478751881166859'
};

function formatMessage(msg) {
  const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const author = msg.author.username || msg.author.global_name || 'Unknown';
  const content = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');
  
  return `[${time}] ${author}: ${content}`;
}

async function peekDiscord(channelName = 'general', limit = 10) {
  const channelId = CHANNELS[channelName] || channelName;
  
  console.log(`🔍 Discord Peek - ${channelName} (last ${limit} messages)`);
  console.log('='.repeat(50));
  
  try {
    // Use Q CLI with Discord MCP to read messages
    const proc = spawn('q', [
      'chat',
      '--agent', 'test-agent',
      '--no-interactive',
      '--trust-all-tools',
      `Read the last ${limit} messages from Discord channel ${channelId} using discord_read_messages. Show each message with timestamp, author, and content.`
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        // Extract the actual response from Q CLI output
        const lines = output.split('\n');
        const responseStart = lines.findIndex(line => line.trim().startsWith('>'));
        if (responseStart !== -1) {
          const response = lines.slice(responseStart).join('\n').replace(/^>\s*/, '');
          console.log(response);
        } else {
          console.log('No messages found or error reading channel.');
        }
      } else {
        console.error('Error reading Discord messages');
      }
      
      console.log('\n💡 This is read-only monitoring. The Discord bot handles responses.');
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Parse command line arguments
const channelName = process.argv[2] || 'general';
const limit = parseInt(process.argv[3]) || 10;

peekDiscord(channelName, limit);

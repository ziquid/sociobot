import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdtempSync, rmdirSync, appendFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ChannelType } from "discord.js";

// Convert Discord mentions and channel references to readable names
function convertMentions(content, client) {
  let converted = content;
  
  // Replace user mentions
  converted = converted.replace(/<@!?(\d+)>/g, (match, userId) => {
    const user = client.users.cache.get(userId);
    return user ? `@${user.username}` : match;
  });
  
  // Replace channel mentions
  converted = converted.replace(/<#(\d+)>/g, (match, channelId) => {
    const channel = client.channels.cache.get(channelId);
    return channel ? `#${channel.name}` : match;
  });
  
  return converted;
}

let consecutiveFailures = 0;
let activeProcesses = 0;

const MAX_FAILURES = 5;
const MAX_CONCURRENT = 3;
const PROCESS_TIMEOUT = 180000;
const BATCH_PROCESS_TIMEOUT = 300000;

export function log(msg) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  console.log(`[${timestamp}] ${msg}`);
}

// Log bot interactions to individual files
function logInteraction(agentName, data) {
  return log(JSON.stringify(data, null, 2));
  const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  const logFile = `./data/logs/interactions_${agentName}.log`;
  const logEntry = `[${timestamp}] ${JSON.stringify(data, null, 2)}\n`;

  try {
    appendFileSync(logFile, logEntry);
  } catch (error) {
    console.error(`Failed to log interaction for ${agentName}:`, error);
  }
}

async function executeQCLI(query, agentName, authorUsername, channel, isBatch = false, debug = false) {
  activeProcesses++;

  const isDM = channel.type === ChannelType.DM;
  const messageSource = isDM ? 'discord-dm' : 'discord';
  const channelName = channel.name || `DM with ${channel.recipient?.username}`;
  
  // Determine privacy: DM channels are always private, guild channels check @everyone permissions
  let privacy = 'public';
  if (isDM) {
    privacy = 'private';
  } else if (channel.guild) {
    // Check if @everyone role can view the channel
    const everyoneRole = channel.guild.roles.everyone;
    const permissions = channel.permissionOverwrites?.cache.get(everyoneRole.id);
    if (permissions && permissions.deny.has('ViewChannel')) {
      privacy = 'private';
    }
  }
  
  const serverName = channel.guild?.name || 'DM';
  
  // Get list of members in the channel
  let members = '';
  if (isDM) {
    members = channel.recipient?.username || '';
  } else if (channel.guild) {
    // Use guild.members.cache (already fetched) and filter by channel permissions
    const cachedMembers = channel.guild.members.cache;
    const channelMembers = cachedMembers.filter(member => 
      channel.permissionsFor(member)?.has('ViewChannel')
    );
    members = channelMembers.map(member => member.user.username).join(',');
  }

  const env = {
    ...process.env,
    ZDS_AI_AGENT_MESSAGE_SOURCE: 'discord',
    ZDS_AI_AGENT_MESSAGE_CHANNEL: channelName,
    ZDS_AI_AGENT_MESSAGE_AUTHOR: authorUsername,
    ZDS_AI_AGENT_MESSAGE_PRIVACY: privacy,
    ZDS_AI_AGENT_MESSAGE_SERVER: serverName,
    ZDS_AI_AGENT_MESSAGE_MEMBERS: members
  };
  
  if (debug) {
    log(`Spawning: zai ${messageSource} ${agentName}`);
    log(`Env vars: ${JSON.stringify({
      ZDS_AI_AGENT_MESSAGE_SOURCE: env.ZDS_AI_AGENT_MESSAGE_SOURCE,
      ZDS_AI_AGENT_MESSAGE_CHANNEL: env.ZDS_AI_AGENT_MESSAGE_CHANNEL,
      ZDS_AI_AGENT_MESSAGE_AUTHOR: env.ZDS_AI_AGENT_MESSAGE_AUTHOR,
      ZDS_AI_AGENT_MESSAGE_PRIVACY: env.ZDS_AI_AGENT_MESSAGE_PRIVACY,
      ZDS_AI_AGENT_MESSAGE_SERVER: env.ZDS_AI_AGENT_MESSAGE_SERVER,
      ZDS_AI_AGENT_MESSAGE_MEMBERS: env.ZDS_AI_AGENT_MESSAGE_MEMBERS
    }, null, 2)}`);
  }

  return new Promise((resolve) => {
    const agentWorkingDir = `/Users/joseph/Documents/ZDS-Agents/${agentName}`;
    // const toolsArg = '--trust-tools=fs_read,fs_write,execute_bash,@MCP_DOCKER/list_directory,@MCP_DOCKER/ffmpeg,@tavily/*';
    const allToolsArg = '-a';

//     const qcli = spawn('q', ['chat', '--agent', agentName, '--no-interactive', allToolsArg, '--resume'], {
    
    const qcli = spawn('zai', [messageSource, agentName], {
      cwd: agentWorkingDir,
      env,
    });
    let output = '';
    let errorOutput = '';

    const timeoutDuration = isBatch ? BATCH_PROCESS_TIMEOUT : PROCESS_TIMEOUT;
    const timeout = setTimeout(() => {
      qcli.kill('SIGTERM');
      activeProcesses--;
      log(`Q CLI process timed out after ${timeoutDuration/1000}s`);
      resolve(null);
    }, timeoutDuration);

    qcli.stdout.on('data', (data) => output += data);
    qcli.stderr.on('data', (data) => errorOutput += data);

    qcli.on('error', (error) => {
      clearTimeout(timeout);
      activeProcesses--;
      consecutiveFailures++;
      log(`Q CLI spawn error: ${error.message}`);
      resolve(null);
    });

    qcli.on('close', (code) => {
      clearTimeout(timeout);
      activeProcesses--;

      if (debug) {
        logInteraction(agentName, {
          type: 'qcli_debug',
          stdout: output.substring(0, 1200),
          stderr: errorOutput.substring(0, 1200),
          query: query.substring(0, 500)
        });
      }

      if (code !== 0) {
        consecutiveFailures++;
        const errorMsg = `Q CLI failed (code ${code}), stdout: ${output}, stderr: ${errorOutput}`;
        log(errorMsg);
        // Log the error for tracking
        logInteraction(agentName, {
          type: 'qcli_error',
          exit_code: code,
          stdout: output.substring(0, 1200),
          stderr: errorOutput.substring(0, 1200),
          query: query.substring(0, 500)
        });
        resolve(null);
        return;
      }

      consecutiveFailures = 0;

      // Extract response from Q CLI output
      let cleanResponse = output;
      cleanResponse = cleanResponse.replace(/\u001b\[[0-9;]*m/g, '');

      const lines = cleanResponse.split('\n');
      let responseStartIndex = -1;

      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('>')) {
          responseStartIndex = i;
          break;
        }
      }

      if (responseStartIndex !== -1) {
        const responseLine = lines[responseStartIndex].replace(/^>\s*/, '').trim();
        const followingLines = lines.slice(responseStartIndex + 1).join('\n').trim();

        cleanResponse = responseLine;
        if (followingLines) {
          cleanResponse += '\n' + followingLines;
        }
      }

      resolve(cleanResponse.trim());
    });

    qcli.stdin.write(query);
    qcli.stdin.end();
  });
}

export async function processRealtimeMessage(message, channel, agentName, debug = false, noDiscord = false) {
  // Circuit breaker - stop if failing repeatedly
  if (consecutiveFailures >= MAX_FAILURES) {
    log(`Circuit breaker: ${consecutiveFailures} failures, not trying`);
    return null;
  }

  // Process limit
  if (activeProcesses >= MAX_CONCURRENT) {
    log(`Process limit reached: ${activeProcesses}`);
    return null;
  }

  try {
    const channelName = channel.name || `DM with ${channel.recipient?.username}`;
    const convertedContent = convertMentions(message.content, message.client);

    // Build query with message content
    let query = `New Discord message from @${message.author.username} (ID: ${message.author.id}) in channel ${channelName} (ID: ${channel.id}):

${convertedContent}`;

    // Add attachment information if present
    if (message.attachments.size > 0) {
      query += '\n\nAttachments:';
      message.attachments.forEach(attachment => {
        const sizeKB = Math.round(attachment.size / 1024);
        const sizeDisplay = sizeKB < 1024 ? `${sizeKB}KB` : `${Math.round(sizeKB / 1024)}MB`;
        query += `\n- ${attachment.name} (${attachment.contentType || 'unknown type'}, ${sizeDisplay}) - ${attachment.url}`;
      });
    }

    // Log the incoming message
    logInteraction(agentName, {
      type: 'message_received',
      channel: channelName,
      author: message.author.username,
      content: convertedContent.substring(0, 200),
      message_id: message.id,
      attachments_count: message.attachments.size
    });

    if (debug) {
      console.log('=== REALTIME QUERY ===');
      console.log(query);
    }

    const response = await executeQCLI(query, agentName, message.author.username, channel, false, debug);

    // Log the Q CLI response
    logInteraction(agentName, {
      type: 'qcli_response',
      message_id: message.id,
      response: response ? response.substring(0, 300) : null,
      success: !!response
    });

    if (debug && response) {
      console.log('=== REALTIME RESPONSE ===');
      console.log(response);
    }

    return response;

  } catch (error) {
    log(`Error in realtime processing: ${error.message}`);
    return null;
  }
}

export async function processBatchedMessages(messages, channel, agentName, debug = false, noDiscord = false) {
  // Circuit breaker - stop if failing repeatedly
  if (consecutiveFailures >= MAX_FAILURES) {
    log(`Circuit breaker: ${consecutiveFailures} failures, not trying`);
    return [];
  }

  // Process limit
  if (activeProcesses >= MAX_CONCURRENT) {
    log(`Process limit reached: ${activeProcesses}`);
    return [];
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'discord-bot-'));
  const inputFile = join(tempDir, 'messages.json');
  const outputFile = join(tempDir, 'responses.json');

  try {
    // Prepare message data
    const messageData = {
      channel: {
        id: channel.id,
        name: channel.name || `DM with ${channel.recipient?.username}`,
        type: channel.type === ChannelType.DM ? 'DM' : 'guild'
      },
      messages: messages.map(msg => ({
        id: msg.id,
        author: {
          id: msg.author.id,
          username: msg.author.username
        },
        content: convertMentions(msg.content, msg.client),
        timestamp: msg.createdAt.toISOString()
      }))
    };

    const messageJson = JSON.stringify(messageData, null, 2);

    const query = `While the bot was down, these messages were sent in ${messageData.channel.name}. The message data is in the file ${inputFile}. Please read the file and respond to whichever messages you wish to, or none at all. Write your responses as a JSON array to ${outputFile} with format: [{"messageId": "123", "response": "your response"}]. Only respond to messages that warrant a response.`;

    if (debug) {
      console.log('=== MESSAGE DATA ===');
      console.log(messageJson);
      console.log('\n=== QUERY ===');
      console.log(query);
    }

    // Write messages to temp file
    writeFileSync(inputFile, messageJson);
    log(`Created input file: ${inputFile}`);

    await executeQCLI(query, agentName, 'batch', channel, true, debug);

    log(`Checking for output file: ${outputFile}`);
    log(`Output file exists: ${existsSync(outputFile)}`);

    // Try to read response file
    let result = [];
    try {
      if (existsSync(outputFile)) {
        const responseContent = readFileSync(outputFile, 'utf8');
        if (debug) {
          console.log('=== AGENT JSON RESPONSE ===');
          console.log(responseContent);
        }
        const responses = JSON.parse(responseContent);
        result = Array.isArray(responses) ? responses : [];
      } else {
        log('No output file created by agent');
      }
    } catch (error) {
      log(`Error reading response file: ${error.message}`);
    }

    return result;

  } catch (error) {
    log(`Error in batch processing: ${error.message}`);
    return [];
  } finally {
    // Clean up temp files
    try {
      rmdirSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      log(`Error cleaning up temp files: ${error.message}`);
    }
  }
}

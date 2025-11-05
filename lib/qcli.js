import { spawn, execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdtempSync, rmdirSync, appendFileSync, mkdirSync, createWriteStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ChannelType } from "discord.js";
import https from "https";
import http from "http";
import { getACL, getMaxACL, addCourtesyMessage } from "./metadata.js";

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

// Download attachment to bot's Downloads directory
async function downloadAttachment(url, filename, agentName) {
  const agentWorkingDir = `/Users/joseph/Documents/ZDS-Agents/${agentName}`;
  const downloadsDir = join(agentWorkingDir, 'Downloads');

  // Create Downloads directory if it doesn't exist
  if (!existsSync(downloadsDir)) {
    mkdirSync(downloadsDir, { recursive: true });
  }

  const filePath = join(downloadsDir, filename);

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(filePath);
      });

      fileStream.on('error', (err) => {
        unlinkSync(filePath);
        reject(err);
      });
    }).on('error', reject);
  });
}

// Transcribe audio file using extract-text command
function transcribeAudio(filePath) {
  try {
    const transcription = execSync(`extract-text "${filePath}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for transcription
      timeout: 60000 // 60 second timeout
    });
    return transcription.trim();
  } catch (error) {
    log(`Failed to transcribe audio ${filePath}: ${error.message}`);
    return null;
  }
}

// Encode text as speech using encode-speech command
export function encodeSpeech(text, agentName) {
  try {
    const audioPath = execSync(`encode-speech ${agentName} -`, {
      input: text,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 60 second timeout
    });
    return audioPath.toString().trim();
  } catch (error) {
    log(`Failed to encode speech for ${agentName}: ${error.message}`);
    return null;
  }
}

// Check if contentType is an audio format
function isAudioFile(contentType) {
  if (!contentType) return false;
  return contentType.startsWith('audio/') ||
         contentType === 'video/ogg'; // Discord voice messages use video/ogg
}

let consecutiveFailures = 0;
let activeProcesses = 0;

const MAX_FAILURES = 5;
const MAX_CONCURRENT = 5;
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

async function executeQCLI(query, agentName, authorUsername, channel, messageTimestamp, currentACL, isBatch = false, debug = false) {
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

  // Get max ACL for this channel
  const maxACL = getMaxACL(channel, debug);

  const env = {
    ...process.env,
    ZDS_AI_AGENT_MESSAGE_SOURCE: 'discord',
    ZDS_AI_AGENT_MESSAGE_CHANNEL: channelName,
    ZDS_AI_AGENT_MESSAGE_AUTHOR: authorUsername,
    ZDS_AI_AGENT_MESSAGE_PRIVACY: privacy,
    ZDS_AI_AGENT_MESSAGE_SERVER: serverName,
    ZDS_AI_AGENT_MESSAGE_MEMBERS: members,
    ZDS_AI_AGENT_MESSAGE_TIMESTAMP: messageTimestamp,
    ZDS_AI_AGENT_MESSAGE_ACL: currentACL.toString(),
    ZDS_AI_AGENT_MESSAGE_MAX_ACL: maxACL.toString(),
    ZDS_AI_AGENT_RESPONSES_ACCEPTED: 'plain text',
    ZDS_AI_AGENT_RESPONSES_FORBIDDEN: 'JSON, YML',
    ZDS_AI_AGENT_PRINT_ONLY: ''
  };

  if (debug) {
    log(`Spawning: zai ${messageSource} ${agentName}`);
    log(`Env vars: ${JSON.stringify({
      ZDS_AI_AGENT_MESSAGE_SOURCE: env.ZDS_AI_AGENT_MESSAGE_SOURCE,
      ZDS_AI_AGENT_MESSAGE_CHANNEL: env.ZDS_AI_AGENT_MESSAGE_CHANNEL,
      ZDS_AI_AGENT_MESSAGE_AUTHOR: env.ZDS_AI_AGENT_MESSAGE_AUTHOR,
      ZDS_AI_AGENT_MESSAGE_PRIVACY: env.ZDS_AI_AGENT_MESSAGE_PRIVACY,
      ZDS_AI_AGENT_MESSAGE_SERVER: env.ZDS_AI_AGENT_MESSAGE_SERVER,
      ZDS_AI_AGENT_MESSAGE_MEMBERS: env.ZDS_AI_AGENT_MESSAGE_MEMBERS,
      ZDS_AI_AGENT_MESSAGE_ACL: env.ZDS_AI_AGENT_MESSAGE_ACL,
      ZDS_AI_AGENT_MESSAGE_MAX_ACL: env.ZDS_AI_AGENT_MESSAGE_MAX_ACL,
      ZDS_AI_AGENT_RESPONSES_ACCEPTED: env.ZDS_AI_AGENT_RESPONSES_ACCEPTED,
      ZDS_AI_AGENT_RESPONSES_FORBIDDEN: env.ZDS_AI_AGENT_RESPONSES_FORBIDDEN
    }, null, 2)}`);
  }

  return new Promise((resolve) => {
    const agentWorkingDir = `/Users/joseph/Documents/ZDS-Agents/${agentName}`;
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

    // Get current ACL from message and check against agent's max ACL
    const currentACL = getACL(message);
    const maxACL = getMaxACL(channel, debug);
    const wouldExceedACL = currentACL >= maxACL - 1;
    const isAtACLLimit = currentACL === maxACL;

    // Build query with message content
    let query = `New Discord message from @${message.author.username} (ID: ${message.author.id}) in channel ${channelName} (ID: ${channel.id}):

${convertedContent}`;

    // Track if this message had audio transcription
    let hadTranscription = false;

    // Add attachment information if present
    if (message.attachments.size > 0) {
      query += '\n\nAttachments:';
      const MAX_DOWNLOAD_SIZE = 10 * 1024 * 1024; // 10MB in bytes

      for (const attachment of message.attachments.values()) {
        const sizeKB = Math.round(attachment.size / 1024);
        const sizeDisplay = sizeKB < 1024 ? `${sizeKB}KB` : `${Math.round(sizeKB / 1024)}MB`;

        // Download if size < 10MB
        if (attachment.size < MAX_DOWNLOAD_SIZE) {
          try {
            const localPath = await downloadAttachment(attachment.url, attachment.name, agentName);
            query += `\n- ${attachment.name} (${attachment.contentType || 'unknown type'}, ${sizeDisplay}) - ${localPath}`;
            if (debug) {
              log(`Downloaded attachment to: ${localPath}`);
            }

            // Transcribe audio files
            if (isAudioFile(attachment.contentType)) {
              if (debug) {
                log(`Transcribing audio file: ${localPath}`);
              }
              const transcription = transcribeAudio(localPath);
              if (transcription) {
                query += `\n  Transcription: ${transcription}`;
                hadTranscription = true;
                if (debug) {
                  log(`Transcription successful (${transcription.length} chars)`);
                }
              }
            }
          } catch (error) {
            log(`Failed to download attachment ${attachment.name}: ${error.message}`);
            // Fall back to URL if download fails
            query += `\n- ${attachment.name} (${attachment.contentType || 'unknown type'}, ${sizeDisplay}) - ${attachment.url}`;
          }
        } else {
          // Keep URL for files >= 10MB
          query += `\n- ${attachment.name} (${attachment.contentType || 'unknown type'}, ${sizeDisplay}) - ${attachment.url}`;
        }
      }
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

    // Add courtesy message if this message would cause response to exceed ACL
    if (wouldExceedACL) {
      query = addCourtesyMessage(query);
      if (debug) {
        log(`ACL limit would be exceeded (${currentACL} >= ${maxACL - 1}), adding courtesy message`);
      }
    }

    // Add special instruction if at exact ACL limit (reactions only)
    if (isAtACLLimit) {
      query += '\n\nNote: You are at the ACL limit. You may only respond with a REACTION (e.g., REACTION:eyes) to acknowledge this message. Text responses will be blocked.';
      if (debug) {
        log(`At ACL limit (${currentACL} === ${maxACL}), reactions-only mode`);
      }
    }

    if (debug) {
      console.log('=== REALTIME QUERY ===');
      console.log(query);
    }

    const response = await executeQCLI(query, agentName, message.author.username, channel, message.createdAt.toLocaleString(), currentACL, false, debug);

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

    // If at ACL limit, allow only REACTION responses
    if (isAtACLLimit) {
      if (debug) {
        log(`At ACL limit (${currentACL} === ${maxACL}), marking as aclLimited for REACTION-only handling`);
      }
      return response ? { response, hadTranscription, aclLimited: true } : null;
    }

    // If beyond ACL limit, block entirely
    if (currentACL > maxACL) {
      if (debug) {
        log(`Beyond ACL limit (${currentACL} > ${maxACL}), blocking response`);
      }
      return null;
    }

    // Return response with transcription flag
    return response ? { response, hadTranscription } : null;

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
    // Get maxACL for this channel
    const maxACL = getMaxACL(channel, debug);

    // Prepare message data
    const messageData = {
      channel: {
        id: channel.id,
        name: channel.name || `DM with ${channel.recipient?.username}`,
        type: channel.type === ChannelType.DM ? 'DM' : 'guild'
      },
      messages: messages.map(msg => {
        const msgACL = getACL(msg);
        const wouldExceedACL = msgACL >= maxACL - 1;
        const isAtACLLimit = msgACL === maxACL;
        return {
          id: msg.id,
          author: {
            id: msg.author.id,
            username: msg.author.username
          },
          content: convertMentions(msg.content, msg.client),
          timestamp: msg.createdAt.toISOString(),
          acl: msgACL,
          informationalOnly: wouldExceedACL && !isAtACLLimit,
          reactionsOnly: isAtACLLimit
        };
      })
    };

    const messageJson = JSON.stringify(messageData, null, 2);

    let query = `While the bot was down, these messages were sent in ${messageData.channel.name}. The message data is in the file ${inputFile}. Please read the file and respond to whichever messages you wish to, or none at all. Write your responses *this time only* as a JSON array to ${outputFile} with format: [{"messageId": "123", "response": "your response"}]. Only respond to messages that warrant a response.`;

    // Add note about informationalOnly field
    const hasInformationalOnly = messageData.messages.some(m => m.informationalOnly);
    if (hasInformationalOnly) {
      query += '\n\nNote: Messages with "informationalOnly": true are for your information only - do not respond to them as your response would not be delivered due to ACL limits.';
    }

    // Add note about reactionsOnly field
    const hasReactionsOnly = messageData.messages.some(m => m.reactionsOnly);
    if (hasReactionsOnly) {
      query += '\n\nNote: Messages with "reactionsOnly": true are at the ACL limit. You may only respond with a REACTION (e.g., REACTION:eyes) to acknowledge these messages. Text responses will be blocked.';
    }

    if (debug) {
      console.log('=== MESSAGE DATA ===');
      console.log(messageJson);
      console.log('\n=== QUERY ===');
      console.log(query);
    }

    // Write messages to temp file
    writeFileSync(inputFile, messageJson);
    log(`Created input file: ${inputFile}`);

    // For batch processing, ACL is included per-message in the JSON file
    // Use 'batch' as a marker value for the environment variable
    await executeQCLI(query, agentName, 'batch', channel, new Date().toLocaleString(), 'batch', true, debug);

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
        const responsesArray = Array.isArray(responses) ? responses : [];

        // Filter out responses to informationalOnly messages, and mark reactionsOnly responses
        const informationalOnlyIds = new Set(
          messageData.messages
            .filter(msg => msg.informationalOnly)
            .map(msg => msg.id)
        );
        const reactionsOnlyIds = new Set(
          messageData.messages
            .filter(msg => msg.reactionsOnly)
            .map(msg => msg.id)
        );

        result = responsesArray
          .filter(response => {
            if (informationalOnlyIds.has(response.messageId)) {
              if (debug) {
                log(`Dropping response to informationalOnly message ${response.messageId} (ACL would exceed limit)`);
              }
              return false;
            }
            return true;
          })
          .map(response => {
            if (reactionsOnlyIds.has(response.messageId)) {
              if (debug) {
                log(`Marking response to reactionsOnly message ${response.messageId} as aclLimited`);
              }
              return { ...response, aclLimited: true };
            }
            return response;
          });

        if (debug && responsesArray.length !== result.length) {
          log(`Filtered ${responsesArray.length - result.length} responses to informationalOnly messages`);
        }
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

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";

function getAgentDataDir(agentName) {
  const homeDir = execSync(`echo ~${agentName}`).toString().trim();
  return `${homeDir}/.zds-ai/sociobot`;
}

export function loadLastProcessedMessages(agentName) {
  const dataDir = getAgentDataDir(agentName);
  const LAST_MESSAGE_FILE = `${dataDir}/last_processed_messages.json`;

  // Ensure directory exists
  mkdirSync(dataDir, { recursive: true });

  if (existsSync(LAST_MESSAGE_FILE)) {
    try {
      return JSON.parse(readFileSync(LAST_MESSAGE_FILE, 'utf8'));
    } catch (error) {
      console.error('Error loading last processed messages:', error);
      return {};
    }
  }
  return {};
}

export function saveLastProcessedMessage(agentName, channelId, messageId) {
  const dataDir = getAgentDataDir(agentName);
  const LAST_MESSAGE_FILE = `${dataDir}/last_processed_messages.json`;
  mkdirSync(dataDir, { recursive: true });
  const lastMessages = loadLastProcessedMessages(agentName);
  lastMessages[channelId] = messageId;

  try {
    writeFileSync(LAST_MESSAGE_FILE, JSON.stringify(lastMessages, null, 2));
  } catch (error) {
    console.error('Error saving last processed message:', error);
  }
}
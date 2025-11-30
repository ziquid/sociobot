import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

export function loadLastProcessedMessages(agentName) {
  const LAST_MESSAGE_FILE = `./data/persistence/last_processed_messages_${agentName}.json`;
  
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
  const LAST_MESSAGE_FILE = `./data/persistence/last_processed_messages_${agentName}.json`;
  mkdirSync('./data/persistence', { recursive: true });
  const lastMessages = loadLastProcessedMessages(agentName);
  lastMessages[channelId] = messageId;
  
  try {
    writeFileSync(LAST_MESSAGE_FILE, JSON.stringify(lastMessages, null, 2));
  } catch (error) {
    console.error('Error saving last processed message:', error);
  }
}
/**
 * @fileoverview Configuration loading from YAML files
 * Loads sociobot configuration from agent home directories
 */

import { readFileSync } from 'fs';
import { load as parseYaml } from 'js-yaml';
import { execSync } from 'child_process';
import { homedir } from 'os';

const configCache = new Map();

/**
 * Expand tilde in path to home directory
 * Supports ~, ~/path, and ~username/path
 */
export function expandTilde(filePath) {
  if (!filePath.startsWith('~')) {
    return filePath;
  }

  // Handle ~ or ~/path (current user)
  if (filePath === '~' || filePath.startsWith('~/')) {
    return filePath.replace('~', homedir());
  }

  // Handle ~username/path (other users)
  const match = filePath.match(/^~([^/]+)(\/.*)?$/);
  if (match) {
    const username = match[1];
    const restOfPath = match[2] || '';

    try {
      // Use shell to expand ~username
      const expandedHome = execSync(`eval echo ~${username}`, { encoding: 'utf-8' }).trim();
      return expandedHome + restOfPath;
    } catch (error) {
      // If expansion fails, return original path
      return filePath;
    }
  }

  return filePath;
}

/**
 * Load and parse configuration for an agent
 * @param {string} agentName - Name of the agent
 * @returns {Object} Normalized configuration object
 * @throws {Error} If config file is missing, invalid, or incomplete
 */
export function getConfig(agentName) {
  // Check cache
  if (configCache.has(agentName)) {
    return configCache.get(agentName);
  }

  // Require ZDS_AI_AGENT_CONFIG_FILE environment variable
  const configPath = process.env.ZDS_AI_AGENT_CONFIG_FILE;
  if (!configPath) {
    console.error('Error: ZDS_AI_AGENT_CONFIG_FILE environment variable is not set');
    process.exit(1);
  }

  // Load YAML
  let rawConfig;
  try {
    const yamlContent = readFileSync(configPath, 'utf8');
    rawConfig = parseYaml(yamlContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Configuration file not found: ${configPath}\n` +
        `Please create config file with required sociobot section.`
      );
    }
    throw new Error(
      `Failed to parse configuration file: ${configPath}\n${error.message}`
    );
  }

  // Validate sociobot section exists
  if (!rawConfig.sociobot) {
    throw new Error(
      `Configuration file missing 'sociobot' section: ${configPath}\n` +
      `Please add sociobot configuration.`
    );
  }

  const sb = rawConfig.sociobot;

  // Build normalized config with defaults
  const config = {
    maxAcl: sb.max_acl,  // undefined if not set
    messageDelay: sb.message_delay || 17000,
    discord: {
      token: sb.discord?.token,
      botUserId: sb.discord?.bot_user_id,
      dmChannelIds: sb.discord?.dm_channel_ids || [],
      guild: {
        ziquid: {
          webhook: {
            id: sb.discord?.guild?.ziquid?.webhook?.id,
            token: sb.discord?.guild?.ziquid?.webhook?.token
          }
        }
      }
    }
  };

  // Cache and return
  configCache.set(agentName, config);
  return config;
}

/**
 * @fileoverview Configuration validation for Discord bot
 * Ensures all required configuration fields are present before startup
 */

import { getConfig } from './config.js';

/**
 * Validate that all required configuration fields are set and show missing fields.
 * @param {string} agentName - Name of the agent
 * @returns {boolean} true if all config fields validate, false if errors are present
 * @example
 * if (!validEnvironment(agentName)) {
 *   process.exit(1);
 * }
 */
export function validEnvironment(agentName) {
  let valid = true;

  try {
    const config = getConfig(agentName);

    const required = [
      { path: 'discord.token', value: config.discord.token },
      { path: 'discord.bot_user_id', value: config.discord.botUserId },
      { path: 'discord.guild.ziquid.webhook.id', value: config.discord.guild.ziquid.webhook.id },
      { path: 'discord.guild.ziquid.webhook.token', value: config.discord.guild.ziquid.webhook.token }
    ];

    for (const field of required) {
      if (!field.value) {
        console.error(`Error: ${field.path} not found in config file`);
        valid = false;
      }
    }

    if (!valid) {
      console.error('\nRequired fields:');
      required.forEach(f => console.error(`  - ${f.path}`));
    }
  } catch (error) {
    console.error(error.message);
    return false;
  }

  return valid;
}

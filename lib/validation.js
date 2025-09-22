/**
 * @fileoverview Environment variable validation for Discord bot
 * Ensures all required configuration variables are present before startup
 */

/**
 * Validate that all required environment variables are set and show missing vars.
 * @returns {boolean} true if all env vars validate, false if errors are present
 * @example
 * if (!validEnvironment()) {
 *   process.exit(1);
 * }
 */
export function validEnvironment() {
  /** @constant {string[]} List of required environment variables */
  const required = [
    'DISCORD_TOKEN',
    'BOT_USER_ID',
    'WEBHOOK_ID',
    'WEBHOOK_TOKEN'
  ];

  let valid = true;

  for (const variable of required) {
    if (!process.env[variable]) {
      console.error(`Error: ${variable} environment variable is not set`);
      valid = false;
    }
  }

  return valid;
}

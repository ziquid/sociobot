export function validateEnvironment() {
  const required = [
    'DISCORD_TOKEN',
    'BOT_USER_ID',
    'WEBHOOK_ID',
    'WEBHOOK_TOKEN'
  ];

  for (const variable of required) {
    if (!process.env[variable]) {
      console.error(`Error: ${variable} environment variable is not set`);
      process.exit(1);
    }
  }
}
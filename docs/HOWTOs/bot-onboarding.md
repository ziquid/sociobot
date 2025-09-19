# Bot Onboarding Guide

## Overview

This guide covers everything needed to onboard a new Discord bot to the ZDS AI system, from Discord application creation to full deployment.

## Prerequisites

- Discord Developer Portal access
- Server admin permissions in target Discord server
- Access to bot hosting environment
- GitHub repository access (if using GitHub integration)

## Step 1: Create Discord Application

### 1.1 Create Bot Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name your bot (e.g., "NewBot")
4. Save the application

### 1.2 Configure Bot Settings
1. Navigate to "Bot" tab
2. Click "Add Bot"
3. Configure bot settings:
   - Set username and avatar
   - **DISABLE** "Public Bot" (keep private)
   - **ENABLE** "Message Content Intent"
   - **ENABLE** "Server Members Intent" 
   - **ENABLE** "Presence Intent"
4. Copy bot token (save securely)

### 1.3 Generate Invite URL
1. Go to "OAuth2" > "URL Generator"
2. Select scopes: `bot`, `applications.commands`
3. Select permissions:
   - Read Messages/View Channels
   - Send Messages
   - Read Message History
   - Use Slash Commands
   - Add Reactions
   - Manage Messages
   - Manage Webhooks
   - Create Public Threads
   - Create Private Threads
4. Copy generated URL

## Step 2: Add Bot to Server

### 2.1 Invite Bot
1. Use invite URL from Step 1.3
2. Select target Discord server
3. Authorize with selected permissions

### 2.2 Get Bot User ID
1. Enable Developer Mode in Discord (User Settings > Advanced)
2. Right-click bot in member list
3. Select "Copy ID"
4. Save Bot User ID

### 2.3 Get Server ID (for whitelist)
1. Right-click server icon
2. Select "Copy ID" 
3. Save Server ID

## Step 3: Create Bot Environment

### 3.1 Create Environment File
Create `.env.<bot-name>` file:

```bash
# Discord Configuration
DISCORD_TOKEN=your_bot_token_here
BOT_USER_ID=your_bot_user_id_here

# Webhook Configuration (will be set in Step 4)
WEBHOOK_ID=
WEBHOOK_TOKEN=

# Optional: DM Channel Configuration
DM_CHANNEL_IDS=

# Optional: Message Processing Delay
BOT_MESSAGE_DELAY=17000

# Optional: HTTP Server Port
HTTP_PORT=
```

### 3.2 Secure Environment File
```bash
# Set proper permissions
chmod 600 .env.<bot-name>

# Verify .env files are in .gitignore
echo ".env.*" >> .gitignore
```

## Step 4: Create Webhooks

### 4.1 Create Bot Webhook
```bash
# Create webhook for main channel (e.g., #bot-testing)
node create-webhooks.js <channel-id>
```

### 4.2 Update Environment File
1. Copy webhook ID and token from output
2. Update `.env.<bot-name>` file:
   ```bash
   WEBHOOK_ID=webhook_id_from_output
   WEBHOOK_TOKEN=webhook_token_from_output
   ```

## Step 5: Role Management

### 5.1 Create Individual Bot Role
```bash
# Create unique role for the bot
node create-role.js "<bot-name> Bot" <admin-bot-name>
```

### 5.2 Assign Shared Role
```bash
# Assign shared "ZDS AI Agents" role
node assign-role.js "ZDS AI Agents" <bot-name> <admin-bot-name>
```

### 5.3 Assign Individual Role
```bash
# Assign bot's individual role
node assign-role.js "<bot-name> Bot" <bot-name> <admin-bot-name>
```

## Step 6: Test Bot Configuration

### 6.1 Verify Channel Access
```bash
# List accessible channels
node list-channels.js <bot-name>
```

### 6.2 Test Messaging
```bash
# Test channel messaging
node test-send-message.js <bot-name> --dms-only

# Test specific channel
node send-message.js <bot-name> <channel-id> "Test message from <bot-name>"
```

### 6.3 Verify Role Assignment
```bash
# Check bot roles and permissions
node list-roles.js <bot-name>
```

## Step 7: Deploy Bot

### 7.1 Add to Bot Control
Update `botctl` script to include new bot:
```bash
# Add bot name to BOTS array in botctl
BOTS=("existing-bot" "new-bot-name")
```

### 7.2 Start Bot
```bash
# Restart all bots to include new bot
./botctl restart
```

### 7.3 Verify Startup
```bash
# Check system logs
./botctl logs

# Check bot status
./botctl status
```



## Step 9: Validation Checklist

### 9.1 Discord Integration
- [ ] Bot appears online in Discord server
- [ ] Bot has correct roles assigned
- [ ] Bot can send messages to channels
- [ ] Bot can receive and process mentions
- [ ] Webhook messages work correctly

### 9.2 Channel Access
- [ ] Bot can access #general channel
- [ ] Bot can access #bot-testing channel  
- [ ] Bot can access #bot-dms channel
- [ ] DM functionality works (if configured)

### 9.3 System Integration
- [ ] Bot starts via botctl
- [ ] Bot logs are generated correctly
- [ ] Environment variables are loaded


### 9.4 Security Verification
- [ ] Bot token is secure and not exposed
- [ ] Webhook credentials are unique to bot
- [ ] Server whitelist is configured (if used)
- [ ] Bot is not public (invite URL restricted)

## Step 10: Documentation Updates

### 10.1 Update Bot Lists
Update documentation with new bot information:
- Add to testing scripts documentation
- Update channel access lists
- Add to role management examples



## Troubleshooting

### Common Issues

**Bot Not Responding:**
1. Check bot token validity
2. Verify bot is online in Discord
3. Check botctl logs for errors
4. Verify environment file permissions

**Permission Errors:**
1. Check bot roles in Discord server
2. Verify channel permissions
3. Re-run role assignment scripts

**Webhook Issues:**
1. Verify webhook credentials in .env file
2. Check webhook exists in target channel
3. Recreate webhook if necessary



### Getting Help

- Check `./botctl logs` for error messages
- Review existing bot configurations for reference
- Test with working bot first to isolate issues
- Use testing scripts to verify each component

## Security Reminders

- Never commit .env files to version control
- Keep bot tokens secure and rotate if compromised
- Use server whitelisting for production bots
- Regularly audit bot permissions and access
- Monitor bot activity logs for unusual behavior

## Maintenance

### Regular Tasks
- Monitor bot uptime and performance
- Update bot permissions as needed
- Rotate credentials periodically
- Review and clean up old logs
- Update documentation as system evolves

### Bot Lifecycle
- **Development:** Use test server for initial setup
- **Staging:** Verify in controlled environment
- **Production:** Deploy with full monitoring
- **Retirement:** Revoke tokens, remove from server, clean up files
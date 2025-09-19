# Discord Webhook Documentation

**Purpose:** Individual webhooks for each bot to prevent message cross-contamination

## Problem Solved

Previously, all bots shared the same webhook credentials, causing:
- Identity confusion between bots
- Message routing issues  
- Inability for bots to communicate with each other properly

## Solution

Each bot now has its own dedicated webhook for proper message isolation.

## Webhook Configuration

Each bot has its own dedicated webhook configured in their respective `.env` files:

### Bot Configuration
- **Config File:** `.env.<agent-name>`
- **Environment Variables:** `WEBHOOK_ID`, `WEBHOOK_TOKEN`


## Maintenance Instructions

### To Recreate Webhooks:
```bash
node create-webhooks.js <channel-id>
```

### To Restart Bots After Webhook Changes:
```bash
./botctl restart
```

### To Verify Webhook Configuration:
```bash
# Check bot's .env file
cat .env.<agent-name> | grep WEBHOOK
```

## Security Notes

- Webhook tokens are sensitive credentials - treat like passwords
- Each bot's .env file contains its unique webhook credentials
- Never share webhook tokens in logs or documentation
- Rotate webhooks if compromised

## Troubleshooting

### Bot Identity Confusion:
1. Verify each bot has unique WEBHOOK_ID and WEBHOOK_TOKEN
2. Restart all bots after credential changes
3. Check botctl logs for startup errors

### Message Routing Issues:
1. Confirm webhooks are created in correct channel
2. Verify bot permissions in target channel
3. Check Discord API rate limits

---
*Webhook credentials are stored securely in individual .env files*
*Never commit webhook tokens or IDs to documentation or version control*

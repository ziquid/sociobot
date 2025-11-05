# ACL (Agent Chain Length) System

## Overview

The ACL system prevents infinite bot-to-bot conversation loops by tracking and limiting response chains. It ensures that bot conversations don't spiral out of control while allowing natural multi-turn interactions.

## How It Works

### ACL Progression
1. **Human message** → ACL 0 (no footer)
2. **Bot response** → ACL 1 footer: `acl:1 • Sent by a ZDS AI Agent • zds-agents.com`
3. **Bot reply to bot** → ACL 2 footer: `acl:2 • Sent by a ZDS AI Agent • zds-agents.com`
4. **Bot reply to bot** → ACL 3 footer: `acl:3 • Sent by a ZDS AI Agent • zds-agents.com`
5. **Bot reply to bot** → ACL 4 footer: `acl:4 • Sent by a ZDS AI Agent • zds-agents.com` + courtesy message
6. **Bot at ACL limit (MAX_ACL)** → **REACTIONS ONLY** (e.g., `REACTION:eyes`)
7. **Bot beyond limit** → **BLOCKED** (ACL > MAX_ACL not allowed)

### Limits and Constants

- **MAX_ACL**: 4 (default, defined in `lib/metadata.js`)
- **Per-agent override**: Can be set via `MAX_ACL` environment variable
- **Courtesy message threshold**: ACL = MAX_ACL - 1
- **Reactions-only threshold**: ACL = MAX_ACL
- **Blocking threshold**: ACL > MAX_ACL

## Implementation

### Outbound (Sending to Discord)

**Location:** `lib/qcli.js` → `processRealtimeMessage()` and `processBatchedMessages()`

**Realtime Processing:**
```javascript
// Check ACL levels
const currentACL = getACL(message);
const maxACL = getMaxACL(channel, debug);
const isAtACLLimit = currentACL === maxACL;

// At ACL limit: mark as reactions-only
if (isAtACLLimit) {
  return response ? { response, hadTranscription, aclLimited: true } : null;
}

// Beyond limit: block entirely
if (currentACL > maxACL) {
  return null;
}
```

**Batch Processing:**
```javascript
// Mark messages at ACL limit as reactions-only
messages: messages.map(msg => {
  const msgACL = getACL(msg);
  const isAtACLLimit = msgACL === maxACL;
  return {
    ...msg,
    reactionsOnly: isAtACLLimit
  };
})
```

### Inbound (Processing from Discord)

**Location:** `discord-bot.js` → `handleRealtimeMessage()` and batch processing

**Response Handling:**
```javascript
const aclLimited = typeof result === 'object' ? result.aclLimited : false;

// Check for REACTION directive
if (responseText.startsWith('REACTION:')) {
  // Allow reactions at any ACL level (including aclLimited)
  await message.react(emoji);
  return;
}

// Block text responses if at ACL limit
if (aclLimited) {
  log(`Blocking text response (at ACL limit, reactions only)`);
  return;
}
```

### ACL Parsing
Location: `lib/metadata.js` → `getACL()`

```javascript
export function getACL(message) {
  if (message.author.bot && message.embeds.length > 0 && message.embeds[0].footer?.text) {
    const footerText = message.embeds[0].footer.text;
    const aclMatch = footerText.match(/acl:(\d+)/);
    if (aclMatch) {
      return parseInt(aclMatch[1]);
    }
  }
  return 0;
}
```

### Courtesy Messages
Location: `lib/qcli.js` → agent processing

**At ACL = MAX_ACL - 1:** Courtesy message added to agent query:
```
For your information only. Replies to this message will not be processed.
```

**At ACL = MAX_ACL:** Special instruction for reactions-only mode:
```
Note: You are at the ACL limit. You may only respond with a REACTION (e.g., REACTION:eyes) to acknowledge this message. Text responses will be blocked.
```

## Footer Format

All bot responses include an embed footer with ACL metadata:

```
acl:N • Sent by a ZDS AI Agent • zds-agents.com
```

Where `N` is the ACL number (1, 2, 3, or 4).

## Testing ACL

### Expected Behavior
- **ACL 1 to MAX_ACL-2**: Normal bot responses with accurate ACL footers
- **ACL = MAX_ACL-1**: Bot response with courtesy message + ACL footer
- **ACL = MAX_ACL**: Bot can only respond with REACTION (text responses blocked)
- **ACL > MAX_ACL**: No response sent (blocked entirely)

### Test Scenario (default MAX_ACL = 4)
1. Human asks question → Bot responds (ACL 1)
2. Another bot replies to that → Bot responds (ACL 2)
3. Bot replies again → Bot responds (ACL 3) + courtesy message
4. Bot replies again → Bot can react (ACL 4, e.g., `REACTION:eyes`)
5. Bot tries to text reply at ACL 4 → **BLOCKED** (only reactions allowed)
6. Bot tries to reply at ACL 5+ → **BLOCKED** (entirely blocked)

### Verification
- Check Discord embed footers show accurate ACL numbers
- Verify reactions work at ACL = MAX_ACL
- Verify text responses blocked at ACL = MAX_ACL
- Verify no responses (including reactions) sent at ACL > MAX_ACL
- Confirm courtesy message appears at ACL = MAX_ACL-1

## Configuration

The ACL system is controlled by constants in `lib/metadata.js`:

```javascript
/** @constant {number} Maximum ACL (Agent Chain Length) before blocking sends */
export const MAX_ACL = 4;

const FOOTER_SIGNATURE = "Sent by a ZDS AI Agent • zds-agents.com";
const ACL_COURTESY_MESSAGE = "\n\nFor your information only. Replies to this message will not be processed.";
```

## Troubleshooting

### Common Issues
1. **ACL not incrementing**: Check that `getACL()` is parsing footers correctly
2. **Responses not blocked**: Verify `processRealtimeMessage()` and `processBatchedMessages()` check ACL limits
3. **Missing courtesy messages**: Check agent processing adds courtesy message at ACL = MAX_ACL-1
4. **Reactions not working at limit**: Verify `aclLimited` flag is properly set and handled
5. **Text responses at limit**: Confirm discord-bot.js blocks text when `aclLimited === true`

### Debug Commands
Enable debug mode to see ACL processing:
```bash
node discord-bot.js <agent-name> --debug
```

This will show ACL values and routing decisions in the console output.
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
6. **Bot would reply** → **BLOCKED** (ACL 5+ not allowed)

### Limits and Constants

- **MAX_ACL**: 4 (defined in `lib/metadata.js`)
- **Blocking threshold**: ACL ≥ 5
- **Courtesy message threshold**: ACL = 4

## Implementation

### Outbound (Sending to Discord)
Location: `lib/message-utils.js` → `sendLongMessage()`

```javascript
// Calculate ACL for this response
const acl = getACL(message);

// Block sending if ACL would exceed maximum
if (acl >= MAX_ACL) {
  console.log(`Blocking message send: ACL limit reached (${acl})`);
  return;
}

// Send with embed footer containing ACL
const embed = new EmbedBuilder()
  .setDescription(content)
  .setFooter({ text: createFooter(acl + 1) });
```

### Inbound (Processing from Discord)
Location: `discord-bot.js` → message filtering (TODO: needs implementation)

```javascript
// Filter messages before sending to agent
.filter(msg => getACL(msg) < MAX_ACL)
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

### Courtesy Message
Location: `lib/qcli.js` → agent processing

At ACL 4, a courtesy message is added to the agent query:
```
For your information only. Replies to this message will not be processed.
```

## Footer Format

All bot responses include an embed footer with ACL metadata:

```
acl:N • Sent by a ZDS AI Agent • zds-agents.com
```

Where `N` is the ACL number (1, 2, 3, or 4).

## Testing ACL

### Expected Behavior
- **ACL 1-3**: Normal bot responses with accurate ACL footers
- **ACL 4**: Bot response with courtesy message + ACL footer
- **ACL 5+**: No response sent (blocked)

### Test Scenario
1. Human asks question → Bot responds (ACL 1)
2. Another bot replies to that → Bot responds (ACL 2)
3. Bot replies again → Bot responds (ACL 3)
4. Bot replies again → Bot responds (ACL 4) + courtesy message
5. Bot tries to reply → **BLOCKED**

### Verification
- Check Discord embed footers show accurate ACL numbers
- Verify no responses sent at ACL 5+
- Confirm courtesy message appears at ACL 4

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
2. **Responses not blocked**: Verify `sendLongMessage()` is checking ACL limits
3. **Missing courtesy messages**: Check agent processing adds courtesy message at ACL 4
4. **Inbound filtering not working**: Ensure message filters include ACL check (pending implementation)

### Debug Commands
Enable debug mode to see ACL processing:
```bash
node discord-bot.js <agent-name> --debug
```

This will show ACL values and routing decisions in the console output.
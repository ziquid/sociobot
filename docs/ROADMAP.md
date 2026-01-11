# Sociobot Roadmap

## Version 0.1.1

### Features

- [✅] Add headshot display support for webhook messages
  - [✅] src/lib/message-utils.js -- Add avatarURL parameter to sendWebhookMessage()
  - [✅] src/helpers/send-message.js -- Pass bot username and avatar URL to webhook

### Bug Fixes

- [✅] Fix ACL defaulting to 0 instead of 1
  - [✅] src/lib/message-utils.js -- Update default ACL value to 1 in sendChannelMessage()
  - [✅] src/lib/message-utils.js -- Update default ACL value to 1 in sendWebhookMessage()
  - [✅] src/helpers/send-message.js -- Explicitly pass ACL=1 to sendChannelMessage()

### Technical Debt

- [✅] Fix JSDoc formatting to comply with ZDSCS 1.1.3
  - [✅] src/lib/message-utils.js:146 -- Use double hyphen in @param acl
  - [✅] src/lib/message-utils.js:174 -- Use double hyphen in @param username
  - [✅] src/lib/message-utils.js:175 -- Use double hyphen in @param avatarURL

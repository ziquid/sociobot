#!/usr/bin/env bun

/**
 * Unit tests for isBotDMsRelevant and hasValidAgentRecipient (sociobot#270)
 *
 * Verifies:
 * 1. Regression from PR #208: bot messages with no bot @mention are dropped
 * 2. Bot messages explicitly @mentioning this agent are routed correctly
 * 3. Fix for #270: bot messages where this agent's name appears only in the body
 *    (not as a real @mention) are NOT routed to this agent
 * 4. Human messages always pass
 * 5. Own messages are always filtered
 */

import { isBotDMsRelevant, hasValidAgentRecipient } from '../src/lib/message-processing.js';
import { sendLongMessage, sendChannelMessage, sendWebhookMessage } from '../src/lib/message-utils.js';
import { BOT_DMS_CHANNEL_ID } from '../src/lib/metadata.js';

const AIDEN_ID = '111111111111111111';
const HARRIET_ID = '222222222222222222';
const ALEX_ID = '333333333333333333';

// Minimal mock of a Discord Collection with has() and some()
function makeUserCollection(users) {
  const map = new Map(users.map(u => [u.id, u]));
  return {
    has: (id) => map.has(id),
    some: (fn) => [...map.values()].some(fn),
  };
}

function makeMsg({ authorId, authorBot, mentionedUserIds = [], content = '' }) {
  const mentionedUsers = mentionedUserIds.map(id => ({
    id,
    bot: [AIDEN_ID, HARRIET_ID, ALEX_ID].includes(id),
  }));
  return {
    id: 'msg-' + Math.random(),
    author: { id: authorId, bot: authorBot },
    mentions: { users: makeUserCollection(mentionedUsers) },
    content,
  };
}

let passed = true;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  OK  ${label}`);
  } else {
    console.log(`  FAIL ${label}: got ${actual}, expected ${expected}`);
    passed = false;
  }
}

const isRelevant = isBotDMsRelevant(AIDEN_ID, 'aiden');

// --- hasValidAgentRecipient ---
console.log('\nhasValidAgentRecipient:');

assert(
  'human message always valid',
  hasValidAgentRecipient(makeMsg({ authorId: 'human-id', authorBot: false })),
  true
);

assert(
  'bot message with bot @mention is valid',
  hasValidAgentRecipient(makeMsg({ authorId: HARRIET_ID, authorBot: true, mentionedUserIds: [ALEX_ID] })),
  true
);

assert(
  'bot message with no @mentions is invalid',
  hasValidAgentRecipient(makeMsg({ authorId: HARRIET_ID, authorBot: true, mentionedUserIds: [] })),
  false
);

assert(
  'bot message with only human @mentions is invalid',
  hasValidAgentRecipient(makeMsg({ authorId: HARRIET_ID, authorBot: true, mentionedUserIds: ['human-user-444'] })),
  false
);

// --- isBotDMsRelevant ---
console.log('\nisBotDMsRelevant:');

assert(
  'own message filtered',
  isRelevant(makeMsg({ authorId: AIDEN_ID, authorBot: true, mentionedUserIds: [AIDEN_ID] })),
  false
);

assert(
  'human message always passes',
  isRelevant(makeMsg({ authorId: 'human-id', authorBot: false, content: 'hey aiden' })),
  true
);

assert(
  'bot message explicitly @mentioning this agent passes',
  isRelevant(makeMsg({ authorId: HARRIET_ID, authorBot: true, mentionedUserIds: [AIDEN_ID] })),
  true
);

assert(
  'bot message @mentioning other agent, this agent named in body -- filtered (regression #270)',
  isRelevant(makeMsg({
    authorId: HARRIET_ID,
    authorBot: true,
    mentionedUserIds: [ALEX_ID],
    // "Aiden" appears in body as a team roster item, not as a recipient
    content: '<@alex-bot-id-333> Here is the team roster:\n- Aiden (Senior Dev)\n- Devon (DevOps)',
  })),
  false
);

assert(
  'bot message with no bot @mention filtered (PR #208 regression)',
  isRelevant(makeMsg({ authorId: HARRIET_ID, authorBot: true, mentionedUserIds: [] })),
  false
);

assert(
  'bot message @mentioning multiple agents including this one passes',
  isRelevant(makeMsg({
    authorId: HARRIET_ID,
    authorBot: true,
    mentionedUserIds: [ALEX_ID, AIDEN_ID],
    content: '<@alex-bot-id-333> <@aiden-bot-id-111> sync up on the ICF demo',
  })),
  true
);

// --- send function bot-dms blocking ---
console.log('\nsend function bot-dms blocking:');

// BOT_DMS_CHANNEL_ID imported from metadata.js

function makeMemberCache(members) {
  const map = new Map(members.map(m => [m.user.id, m]));
  return {
    get: (id) => map.get(id),
    find: (fn) => [...map.values()].find(fn),
  };
}

const botMember = { user: { id: HARRIET_ID, bot: true, username: 'harriet' }, nickname: 'harriet-nick' };
const humanMember = { user: { id: 'human-id', bot: false, username: 'human' }, nickname: null };
const guild = { members: { cache: makeMemberCache([botMember, humanMember]) } };

async function assertThrows(label, fn, expectedMsg) {
  try {
    await fn();
    console.log(`  FAIL ${label}: expected throw but did not throw`);
    passed = false;
  } catch (e) {
    if (e.message.includes(expectedMsg)) {
      console.log(`  OK  ${label}`);
    } else {
      console.log(`  FAIL ${label}: threw "${e.message}", expected to include "${expectedMsg}"`);
      passed = false;
    }
  }
}

async function assertNoThrow(label, fn) {
  try {
    await fn();
    console.log(`  OK  ${label}`);
  } catch (e) {
    console.log(`  FAIL ${label}: unexpected throw: ${e.message}`);
    passed = false;
  }
}

const botDmsChannel = {
  id: BOT_DMS_CHANNEL_ID,
  guild,
  send: async () => {},
};

const otherChannel = {
  id: 'other-channel-id',
  guild,
  send: async () => {},
};

const botDmsMessage = {
  id: 'msg-1',
  channel: botDmsChannel,
  guild,
  content: '',
  mentions: { everyone: false },
  author: { id: 'human-id', bot: false, username: 'human' },
  client: { user: { id: AIDEN_ID, username: 'aiden' } },
  reply: async () => {},
  reference: null,
};

const botDmsWebhook = {
  channelId: BOT_DMS_CHANNEL_ID,
  guild,
  send: async () => {},
};

const otherWebhook = {
  channelId: 'other-channel-id',
  guild,
  send: async () => {},
};

// sendChannelMessage
await assertThrows(
  'sendChannelMessage to bot-dms with no mention blocked',
  () => sendChannelMessage(botDmsChannel, '<response>hello everyone</response>', 1, true),
  'bot-dms message blocked'
);

await assertThrows(
  'sendChannelMessage to bot-dms with human @mention blocked',
  () => sendChannelMessage(botDmsChannel, `<response>hey <@human-id> what's up</response>`, 1, true),
  'bot-dms message blocked'
);

await assertNoThrow(
  'sendChannelMessage to bot-dms with bot @mention allowed',
  () => sendChannelMessage(botDmsChannel, `<response><@${HARRIET_ID}> hello</response>`, 1, true)
);

await assertNoThrow(
  'sendChannelMessage to bot-dms with @username of bot allowed',
  () => sendChannelMessage(botDmsChannel, '<response>@harriet hello</response>', 1, true)
);

await assertNoThrow(
  'sendChannelMessage to bot-dms with @nickname of bot allowed',
  () => sendChannelMessage(botDmsChannel, '<response>@harriet-nick hello</response>', 1, true)
);

await assertThrows(
  'sendChannelMessage to bot-dms with @username of human blocked',
  () => sendChannelMessage(botDmsChannel, '<response>@human hello</response>', 1, true),
  'bot-dms message blocked'
);

await assertNoThrow(
  'sendChannelMessage to non-bot-dms channel always allowed',
  () => sendChannelMessage(otherChannel, '<response>hello everyone</response>', 1, true)
);

// sendWebhookMessage
await assertThrows(
  'sendWebhookMessage to bot-dms with no mention blocked',
  () => sendWebhookMessage(botDmsWebhook, '<response>hello everyone</response>', 1, null, null, true),
  'bot-dms message blocked'
);

await assertNoThrow(
  'sendWebhookMessage to bot-dms with bot @mention allowed',
  () => sendWebhookMessage(botDmsWebhook, `<response><@${HARRIET_ID}> hello</response>`, 1, null, null, true)
);

await assertNoThrow(
  'sendWebhookMessage to non-bot-dms channel always allowed',
  () => sendWebhookMessage(otherWebhook, '<response>hello everyone</response>', 1, null, null, true)
);

// sendLongMessage
await assertThrows(
  'sendLongMessage to bot-dms with no mention blocked',
  () => sendLongMessage(botDmsMessage, '<response>hello everyone</response>'),
  'bot-dms message blocked'
);

await assertNoThrow(
  'sendLongMessage to bot-dms with bot @mention allowed',
  () => sendLongMessage(botDmsMessage, `<response><@${HARRIET_ID}> hello</response>`)
);

// --- Final result ---
console.log('\n' + '='.repeat(50));
if (passed) {
  console.log('All bot-dms routing tests PASSED');
  process.exit(0);
} else {
  console.log('Some tests FAILED');
  process.exit(1);
}

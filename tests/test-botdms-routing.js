#!/usr/bin/env node

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

const AIDEN_ID = 'aiden-bot-id-111';
const HARRIET_ID = 'harriet-bot-id-222';
const ALEX_ID = 'alex-bot-id-333';

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

// --- Final result ---
console.log('\n' + '='.repeat(50));
if (passed) {
  console.log('All bot-dms routing tests PASSED');
  process.exit(0);
} else {
  console.log('Some tests FAILED');
  process.exit(1);
}

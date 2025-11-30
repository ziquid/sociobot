#!/usr/bin/env node

import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load test configuration
dotenv.config({ path: '.env.test-agent' }); // Use test agent for testing

const TEST_CHANNEL_ID = process.env.TEST_CHANNEL_ID;
const TEST_USER_ID = process.env.TEST_USER_ID;

if (!TEST_CHANNEL_ID) {
  console.error('Error: TEST_CHANNEL_ID not found in .env.test-agent');
  console.error('Add TEST_CHANNEL_ID=<channel-id> to .env.test-agent');
  process.exit(1);
}

console.log('🧪 Testing send-message.js script...\n');

const DMS_ONLY = process.argv.includes('--dms-only');

const tests = [];

if (!DMS_ONLY) {
  tests.push(
    {
      name: 'Channel Message - Short',
      cmd: `node src/helpers/send-message.js test-agent ${TEST_CHANNEL_ID} "Test message from send-message.js script"`
    },
    {
      name: 'Channel Message - Long',
      cmd: `node src/helpers/send-message.js test-agent ${TEST_CHANNEL_ID} "${'This is a test of long message splitting. '.repeat(100)}"`
    }
  );
}

// Add DM test if TEST_USER_ID is configured
if (TEST_USER_ID) {
  tests.push({
    name: 'Direct Message',
    cmd: `node src/helpers/send-message.js test-agent dm ${TEST_USER_ID} "Test DM from send-message.js script"`
  });
} else if (DMS_ONLY) {
  console.log('❌ Cannot test DMs - TEST_USER_ID not configured in .env.test-agent');
  process.exit(1);
} else {
  console.log('⚠️  Skipping DM test - add TEST_USER_ID to .env.test-agent to enable');
}

let passed = 0;
let failed = 0;

for (const test of tests) {
  console.log(`🔄 Running: ${test.name}`);
  
  try {
    const output = execSync(test.cmd, { 
      encoding: 'utf8',
      timeout: 10000
    });
    
    if (output.includes('Message sent successfully')) {
      console.log(`✅ ${test.name} - PASSED`);
      passed++;
    } else {
      console.log(`❌ ${test.name} - FAILED (unexpected output)`);
      console.log(`   Output: ${output.trim()}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name} - FAILED`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
  
  console.log('');
}

console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n💡 Troubleshooting:');
  console.log('- Verify TEST_CHANNEL_ID is correct in .env.test-agent');
  console.log('- Ensure bot has permission to send messages in test channel');
  console.log('- Check that DISCORD_TOKEN is valid in .env.test-agent');
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed!');
}
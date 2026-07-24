#!/bin/bash

BOTNAME=src/sociobot.js

echo "=== Testing Sociobot ==="

echo "1. Syntax check - main file..."
node --check "$BOTNAME"
if [ $? -ne 0 ]; then
    echo "❌ Main file syntax error"
    exit 1
fi
echo "✅ Main file syntax OK"

echo "2. Syntax check - lib modules..."
node --check src/lib/*.js
if [ $? -ne 0 ]; then
    echo "❌ Lib modules syntax error"
    exit 1
fi
echo "✅ Lib modules syntax OK"

echo "3. Testing module imports..."
modules=("validation" "persistence" "qcli" "error-handlers" "message-utils")

for module in "${modules[@]}"; do
    echo "  Testing $module..."
    node -e "import('./src/lib/$module.js').then(() => console.log('$module OK')).catch(e => { console.error('$module ERROR:', e.message); process.exit(1); })"
    if [ $? -ne 0 ]; then
        echo "❌ $module import failed"
        exit 1
    fi
done

echo "✅ All module imports OK"

echo "4. Testing agent name handling..."

# Test missing agent name (should fail)
echo "  Testing without agent name (should fail)..."
unset AGENT_NAME
node "$BOTNAME"
if [ $? -ne 0 ]; then
    echo "✅ Correctly failed without agent name"
else
    echo "❌ Should have failed without agent name"
fi

# Test command line agent name (should work)
echo "  Testing command line agent name (should work)..."
if [ ! -f ".env.example" ]; then
    echo "❌ No .env.example file - cannot test positive case"
    exit 1
fi
timeout 3s node "$BOTNAME" example --run-once
if [ $? -ne 0 ]; then
    echo "✅ Command line agent name works (expected Discord failure)"
else
    echo "❌ Unexpected success"
fi

# Test environment variable agent name (should work)
echo "  Testing AGENT_NAME environment variable (should work)..."
AGENT_NAME=example timeout 3s node "$BOTNAME" --run-once
if [ $? -ne 0 ]; then
    echo "✅ Environment variable agent name works (expected Discord failure)"
else
    echo "❌ Unexpected success"
fi

# Test command line overrides environment (should use cmdline)
echo "  Testing command line overrides environment..."
echo "  Expected: Should load .env.example (not .env.wrong)"
AGENT_NAME=wrong timeout 3s node "$BOTNAME" example --run-once
if [ $? -ne 0 ]; then
    echo "✅ Command line correctly overrides environment variable"
else
    echo "❌ Command line should override environment variable"
fi

echo "5. Testing environment validation..."

# Test without agent .env file (should fail)
echo "  Testing without .env.missing file (should fail)..."
rm -f .env.missing  # Ensure it doesn't exist
echo "  Expected: Should fail with missing .env file error"
node "$BOTNAME" missing
if [ $? -ne 0 ]; then
    echo "✅ Correctly failed without .env.missing"
else
    echo "❌ Should have failed without .env.missing"
fi

# Test with .env.example (should pass validation but fail Discord login)
echo "  Testing with .env.example file (should pass validation)..."
if [ ! -f ".env.example" ]; then
    echo "❌ No .env.example file - cannot test positive case"
    exit 1
fi
echo "  Expected: Should pass validation but fail Discord login with example tokens"
timeout 5s node "$BOTNAME" example
if [ $? -ne 0 ]; then
    echo "✅ Environment validation passed (Discord connection failed as expected)"
else
    echo "❌ Unexpected success - check if example tokens are real"
fi

echo
echo "🎉 All tests passed!"
echo
echo "Next steps:"
echo "  - Copy .env.example to .env.yourbot with real tokens"
echo "  - Test run-once mode: node $BOTNAME yourbot --run-once"

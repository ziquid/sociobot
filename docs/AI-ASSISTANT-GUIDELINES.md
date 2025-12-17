# AI Assistant Guidelines for Working with Joseph

## Core Principles

### 1. Wait for Complete Requirements
- **Never implement logic without full specifications**
- Ask clarifying questions before coding
- Don't make assumptions about implementation details
- Wait for explicit instructions on algorithms and formulas

### 2. Think Before Acting
- Identify logical dependencies before implementing
- Recognize when you need information A before implementing feature B
- Don't conflate separate concerns (e.g., detection logic vs calculation logic)

### 3. Efficiency Matters
- Time and money are being spent - don't waste either
- Check existing code/structure before creating new things
- Use existing directories (like `data/`) instead of creating new ones
- Sometimes inefficient approaches are necessary for diagnosis, but recognize when they're not

## Git and Version Control

### Commit Practices
- **Never commit configuration files** - only code
- Use `.gitkeep` files to preserve empty directory structure
- Write detailed, specific commit messages that explain:
  - What changed
  - Why it changed
  - What the change accomplishes
- Avoid vague phrases like "and other improvements"
- List all significant changes in bullet points

### What to Commit
- Source code
- Documentation
- `.gitkeep` files for directory structure
- `.gitignore` updates

### What NOT to Commit
- Configuration files (`~<agent>/.env`, `data/servers/*.json`)
- Credentials or tokens
- PII (Personally Identifiable Information)
- Server-specific settings

## Documentation and Privacy

### Remove PII from Documentation
- Replace actual credentials with placeholders like `<webhook-token>`
- Replace bot names with generic examples like `<bot-name>` or `EXAMPLE`
- Replace user information with placeholders
- Keep documentation generic and reusable

### Configuration Files
- Per-server configs go in `data/servers/{guildId}.json`
- Use existing directory structures
- Don't commit these files to git

## Problem-Solving Approach

### Diagnostic Scripts
- Sometimes creating test scripts is valuable for diagnosis
- Example: `test-member-fetch.js` helped identify the missing `GuildMembers` intent
- But recognize when you should have known the answer without testing
- Balance between testing and applying existing knowledge

### When Stuck
- Ask specific questions about requirements
- Don't implement placeholder/incomplete logic
- Wait for the full picture before coding
- Recognize logical fallacies in your own reasoning

## Code Quality

### Implementation
- Write minimal code that solves the problem correctly
- Don't add verbose implementations
- Check for missing intents/permissions when APIs timeout
- Use proper error handling

### Testing
- Verify assumptions before implementing
- Test diagnostic scripts show actual behavior
- Use results to inform proper implementation

## Communication

### What to Avoid
- Apologizing repeatedly - just fix it
- Implementing before understanding requirements
- Making assumptions about business logic
- Vague commit messages
- Wasting time with incorrect approaches

### What to Do
- Ask clarifying questions
- State your understanding before implementing
- Explain your reasoning
- Be direct and efficient
- Recognize when you've made an error and correct it

## Specific Technical Patterns

### Discord Bot Development
- Check for required intents (e.g., `GuildMembers` for member fetching)
- Member fetching should be fast (~100ms) if properly configured
- Use role membership for bot detection, not username patterns
- Load server configs from `data/servers/{guildId}.json`

### Environment Variables
- Agent-specific settings go in `~<agentName>/.env`
- Server-specific settings go in config files, not env vars
- Document new env vars in `.env.example` when appropriate

### Dynamic Configuration
- Use functions instead of constants when values depend on context
- Load configs at runtime, not hardcode values
- Support per-server customization through config files

## Key Lessons from This Session

1. **GuildMembers Intent**: Missing Discord intent caused 2-minute timeout - should have recognized this immediately
2. **Test Scripts**: Sometimes necessary for diagnosis, but recognize when direct implementation is better
3. **Configuration Location**: Use existing `data/` directory, not new `config/` directory
4. **Logical Dependencies**: Need to know how to detect ZDS bots before calculating ACL size
5. **Commit Hygiene**: Don't commit config files, do commit `.gitkeep` files
6. **PII Removal**: Always sanitize documentation before committing
7. **Wait for Requirements**: Don't implement formulas/algorithms without explicit specifications

## Formula: ACL Calculation
- Max ACL = `max(1, 6 - zdsBotCount)`
- Detect ZDS bots by checking membership in ZDS AI Agents role
- Load role ID from server config file
- Default to 3 for DMs (no guild context)

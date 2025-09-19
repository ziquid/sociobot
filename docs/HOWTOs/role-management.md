# Role Management HOWTOs

## List Bot Roles and Permissions

Check what roles and permissions each bot has:

```bash
node list-roles.js <agent-name>
```

**Examples:**
```bash
node list-roles.js testbot
```

## Create New Roles

Create a new Discord role (requires bot with "Manage Roles" permission):

```bash
node create-role.js <role-name> <admin-agent>
```

**Examples:**
```bash
node create-role.js "Test Bots" "testbot"
node create-role.js "Test Role" "testbot"
```

**Note:** If bot lacks "Manage Roles" permission, create the role manually in Discord server settings.

## Assign Roles to Bots

Assign an existing role to a specific bot:

```bash
node assign-role.js <role-name> <target-agent> <admin-agent>
```

**Examples:**
```bash
node assign-role.js "Test Role" "testbot" "testbot"
```

## Current Bot Roles

All ZDS bots currently have:

### Bot Roles:
- **Individual Roles:** Each bot has its own role for identification
- **Shared Roles:** Bots may share common roles for permissions

## Role Assignment Process

The assign-role script:
1. Reads `BOT_USER_ID` from target bot's `.env` file
2. Uses admin bot's credentials for Discord API access
3. Finds the role by exact name match
4. Assigns role to target bot by user ID

## Permissions

All ZDS bots have comprehensive permissions including:
- ViewChannel, SendMessages, ReadMessageHistory
- ManageChannels, ManageMessages, ManageWebhooks
- AttachFiles, EmbedLinks, UseApplicationCommands
- CreatePublicThreads, CreatePrivateThreads
- And many more standard Discord permissions

## Troubleshooting

- **"Missing Permissions":** Admin bot needs "Manage Roles" permission
- **"Role not found":** Check exact role name spelling and case
- **"Bot not found":** Verify target agent's `.env` file has correct `BOT_USER_ID`
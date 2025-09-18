# Security Setup Instructions

## IMPORTANT: Discord Token Configuration

⚠️ **SECURITY WARNING**: This bot requires your Discord user token to function. Never commit your real token to Git!

### Setup Steps:

1. **Get your Discord token**:
   - Open Discord in your browser
   - Press F12 to open Developer Tools
   - Go to Network tab
   - Send a message in any channel
   - Look for a request to `messages` 
   - In the Headers, find `authorization` - that's your token

2. **Configure the bot**:
   - Copy `Settings_Mudae_TEMPLATE.json` to `Settings_Mudae.json`
   - Replace `YOUR_DISCORD_USER_TOKEN_HERE` with your real Discord token
   - Update channel IDs and guild IDs with your server's actual IDs
   - Configure your desired character names, series, and kakera settings

3. **Channel/Guild ID Setup**:
   - Enable Developer Mode in Discord (Settings > Advanced > Developer Mode)
   - Right-click on channels/servers to copy their IDs
   - Update the following in Settings_Mudae.json:
     - `channel_ids`: Channels where the bot will roll and monitor
     - `slash_ids`: Channels for slash commands  
     - `slash_guild_ids`: Guild IDs for slash commands

### Available Bot Versions:

- **mudaebot3.py**: Uses discord.py-self (recommended, more stable)
- **MudaeAutoBot.py**: Uses discum library (legacy, more complex)

### Risk Warning:

This is a Discord selfbot. Using selfbots violates Discord's Terms of Service and may result in account suspension. Use at your own risk.
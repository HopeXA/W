# Discord Waifu Collection Bot

A Mudae-inspired Discord bot for collecting anime characters with gacha mechanics, trading, wishlists, and social features.

## Features

- 🎲 **Character Gacha System** - Random character spawning with rarity-based weights
- 💖 **Character Claiming** - React with heart emoji to claim spawned characters
- 📊 **User Profiles** - Track collection stats, kakera currency, and daily claims
- 📚 **Character Collections** - View your collected characters with pagination
- 🌟 **Wishlist System** - Add desired characters to your wishlist
- 🔍 **Search Function** - Search for characters by name or series
- 🏆 **Leaderboards** - Server rankings by collection size or kakera
- 📅 **Daily Limits** - 10 claims per day with midnight UTC reset
- ⏰ **Cooldown System** - 1 minute between claims to prevent spam

## Commands

### User Commands
- `/profile [user]` - View your or another user's profile
- `/collection [user] [page]` - View character collection
- `/wishlist view` - View your wishlist
- `/wishlist add <character>` - Add character to wishlist
- `/wishlist remove <character>` - Remove character from wishlist
- `/search <query>` - Search for characters
- `/leaderboard [type]` - View server leaderboards
- `/daily` - Check daily claim status

### Admin Commands
- `/roll` - Manually spawn a character (requires Manage Messages)

## Setup

1. Add your Discord bot token and client ID to environment variables
2. Run the bot with `npm start`
3. The bot will automatically register slash commands and initialize the database

## Game Mechanics

- **Rarity System**: Characters have 1-5 star rarities affecting spawn rates
- **Kakera Currency**: Earned when claiming characters or duplicates
- **Daily Claims**: Limited to 10 claims per day per user
- **Claim Cooldown**: 1 minute between individual claims
- **Auto Spawning**: Characters spawn automatically every 30 minutes in active servers

## Database

Uses PostgreSQL with Drizzle ORM for:
- User profiles and statistics
- Character database with series and rarity info
- Collection tracking with claim history
- Wishlist management
- Trading system (future feature)
- Server-specific settings
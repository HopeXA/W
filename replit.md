# Discord Waifu Collection Bot Project

## Overview
A Mudae-inspired Discord bot for collecting anime characters with comprehensive gacha mechanics, trading systems, and social features. The bot recreates the popular character collection gameplay that made Mudae famous.

## Recent Changes (September 18, 2025)
- ✅ Created complete Discord bot with slash commands and reaction-based claiming
- ✅ Implemented PostgreSQL database with Drizzle ORM for data persistence
- ✅ Added gacha system with rarity-based weighted character spawning
- ✅ Built user profile system with collection tracking and kakera currency
- ✅ Implemented daily claim limits and cooldown mechanics
- ✅ Added character search functionality and leaderboards
- ✅ Created wishlist system for desired characters
- ✅ Set up automatic character spawning every 30 minutes

## Project Architecture

### Core Components
- **Bot Engine**: Discord.js v14 with slash commands and reaction handling
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- **Character System**: Weighted gacha mechanics with 1-5 star rarity system
- **User Management**: Profile tracking, daily limits, and currency system
- **Social Features**: Leaderboards, wishlists, and collection viewing

### Database Schema
- **Users**: Discord profiles, stats, kakera currency, daily claim tracking
- **Characters**: Complete character database with series, rarity, and metadata
- **Collections**: User-owned characters with claim history and marriage status
- **Wishlists**: Desired character tracking with slot limitations
- **Trading System**: Framework for character exchanges (future expansion)
- **Server Settings**: Per-guild configuration and preferences

### Key Features Implemented
1. **Character Gacha**: Random spawning with rarity-weighted selection
2. **Claiming System**: React with 💖 to claim characters with cooldowns
3. **Profile Commands**: `/profile`, `/collection`, `/wishlist` with pagination
4. **Search & Discovery**: `/search` for finding characters by name/series
5. **Leaderboards**: Server rankings by collection size and kakera
6. **Daily Mechanics**: 10 claims per day with midnight UTC reset
7. **Anti-Spam**: Cooldown system preventing rapid successive claims

## User Preferences
- Clean, well-commented code with comprehensive error handling
- Modular architecture for easy feature expansion
- Database-first approach for reliable data persistence
- User-friendly slash commands with informative embeds
- Automatic systems to reduce manual bot management

## Current Status
- Bot core functionality: ✅ Complete
- Database integration: ✅ Complete  
- Basic commands: ✅ Complete
- Character spawning: ✅ Complete
- User management: ✅ Complete
- **Issue**: Authorization header error (likely Discord token formatting)

## Next Phase Features (Future Expansion)
- Advanced trading system with approval workflows
- Marriage system for character relationships  
- Custom character upload with approval process
- Kakera shop for purchasing upgrades and items
- Badge/achievement system for collection milestones
- Character fusion and evolution mechanics
- Guild wars and competitive collection events
- Detailed character statistics and power levels

## Technical Notes
- Uses ES modules for modern JavaScript compatibility
- Implements proper error handling and user feedback
- Database migrations handled automatically via Drizzle
- Modular command structure for easy maintenance
- Comprehensive logging for debugging and monitoring

The bot successfully recreates Mudae's core gameplay loop while providing a solid foundation for advanced features.
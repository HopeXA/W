// Database schema for the Discord Waifu Collection Bot
import { 
  pgTable, 
  text, 
  integer, 
  timestamp, 
  boolean, 
  serial, 
  varchar,
  numeric,
  json
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - stores Discord user information and their bot stats
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  discordId: varchar('discord_id', { length: 20 }).unique().notNull(),
  username: varchar('username', { length: 100 }).notNull(),
  globalName: varchar('global_name', { length: 100 }),
  dailyClaims: integer('daily_claims').default(0),
  lastClaimReset: timestamp('last_claim_reset').defaultNow(),
  totalCharacters: integer('total_characters').default(0),
  kakera: integer('kakera').default(0), // In-game currency
  wishlistSlots: integer('wishlist_slots').default(3),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Guild members - tracks user participation per server for server-scoped leaderboards
export const guildMembers = pgTable('guild_members', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  joinedAt: timestamp('joined_at').defaultNow(),
  lastActiveAt: timestamp('last_active_at').defaultNow()
});

// Characters table - stores all available characters in the bot
export const characters = pgTable('characters', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  series: varchar('series', { length: 255 }).notNull(),
  rarity: integer('rarity').notNull(), // 1-5 star rarity
  imageUrl: text('image_url'),
  description: text('description'),
  gender: varchar('gender', { length: 20 }),
  tags: json('tags').$type(), // Array of character tags
  claimValue: integer('claim_value').default(0), // Kakera value when claimed
  createdAt: timestamp('created_at').defaultNow()
});

// User collections - which characters each user owns
export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  characterId: integer('character_id').references(() => characters.id).notNull(),
  claimedAt: timestamp('claimed_at').defaultNow(),
  claimNumber: integer('claim_number'), // Which claim number this was for the user
  married: boolean('married').default(false), // Marriage status with character
  marriedAt: timestamp('married_at')
});

// Wishlists - characters users want to collect
export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  characterId: integer('character_id').references(() => characters.id).notNull(),
  addedAt: timestamp('added_at').defaultNow()
});

// Trading system - trade offers between users
export const trades = pgTable('trades', {
  id: serial('id').primaryKey(),
  fromUserId: integer('from_user_id').references(() => users.id).notNull(),
  toUserId: integer('to_user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 20 }).default('pending'), // pending, accepted, rejected, cancelled
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at')
});

// Trade items - characters being offered in trades
export const tradeItems = pgTable('trade_items', {
  id: serial('id').primaryKey(),
  tradeId: integer('trade_id').references(() => trades.id).notNull(),
  collectionId: integer('collection_id').references(() => collections.id).notNull(),
  isOffered: boolean('is_offered').notNull() // true if offered by sender, false if requested from receiver
});

// Server settings - per-server configuration
export const serverSettings = pgTable('server_settings', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).unique().notNull(),
  prefix: varchar('prefix', { length: 10 }).default('w!'),
  spawnChannel: varchar('spawn_channel', { length: 20 }),
  spawnRate: integer('spawn_rate').default(30), // Minutes between spawns
  maxDailyClaims: integer('max_daily_claims').default(10),
  enableTrading: boolean('enable_trading').default(true),
  enableWishlists: boolean('enable_wishlists').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Define relations between tables
export const usersRelations = relations(users, ({ many }) => ({
  collections: many(collections),
  wishlists: many(wishlists),
  sentTrades: many(trades, { relationName: 'sentTrades' }),
  receivedTrades: many(trades, { relationName: 'receivedTrades' }),
  guildMemberships: many(guildMembers)
}));

export const guildMembersRelations = relations(guildMembers, ({ one }) => ({
  user: one(users, {
    fields: [guildMembers.userId],
    references: [users.id]
  })
}));

export const charactersRelations = relations(characters, ({ many }) => ({
  collections: many(collections),
  wishlists: many(wishlists)
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, {
    fields: [collections.userId],
    references: [users.id]
  }),
  character: one(characters, {
    fields: [collections.characterId],
    references: [characters.id]
  }),
  tradeItems: many(tradeItems)
}));

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  user: one(users, {
    fields: [wishlists.userId],
    references: [users.id]
  }),
  character: one(characters, {
    fields: [wishlists.characterId],
    references: [characters.id]
  })
}));

export const tradesRelations = relations(trades, ({ one, many }) => ({
  fromUser: one(users, {
    fields: [trades.fromUserId],
    references: [users.id],
    relationName: 'sentTrades'
  }),
  toUser: one(users, {
    fields: [trades.toUserId],
    references: [users.id],
    relationName: 'receivedTrades'
  }),
  items: many(tradeItems)
}));

export const tradeItemsRelations = relations(tradeItems, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeItems.tradeId],
    references: [trades.id]
  }),
  collection: one(collections, {
    fields: [tradeItems.collectionId],
    references: [collections.id]
  })
}));

// Types are available for TypeScript intellisense through inference
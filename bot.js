// Discord Waifu Collection Bot - Main Entry Point
// A Mudae-inspired Discord bot for collecting anime characters

import { 
  Client, 
  GatewayIntentBits, 
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
} from 'discord.js';

import { db } from './server/db.js';
import { 
  users, 
  characters, 
  collections, 
  wishlists, 
  serverSettings,
  guildMembers 
} from './shared/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable is required!');
  console.log('Please add your Discord bot token to the secrets.');
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error('❌ CLIENT_ID environment variable is required!');
  console.log('Please add your Discord application client ID to the secrets.');
  process.exit(1);
}

// Create Discord client with necessary intents and partials for reliable message handling
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    'MESSAGE',
    'CHANNEL', 
    'REACTION',
    'USER'
  ]
});

// Character spawning system
let lastSpawn = Date.now();
const SPAWN_COOLDOWN = 30 * 60 * 1000; // 30 minutes in milliseconds
const CLAIM_COOLDOWN = 60 * 1000; // 1 minute between claims
const CLAIM_WINDOW = 15 * 60 * 1000; // 15 minutes to claim a character
const userClaimCooldowns = new Map();

// Persistent spawn tracking (in production, this should be database-backed)
const activeSpawns = new Map(); // messageId -> { characterId, spawnTime, guildId, channelId }

// Sample character data (in a real bot, this would come from an API or large database)
const sampleCharacters = [
  {
    name: "Nezuko Kamado",
    series: "Demon Slayer",
    rarity: 4,
    imageUrl: "https://i.imgur.com/placeholder1.jpg", // Placeholder URL
    description: "The demon sister of Tanjiro Kamado",
    gender: "Female",
    tags: ["demon", "cute", "protective"],
    claimValue: 50
  },
  {
    name: "Miku Hatsune",
    series: "Vocaloid",
    rarity: 5,
    imageUrl: "https://i.imgur.com/placeholder2.jpg", // Placeholder URL
    description: "The world's most famous virtual singer",
    gender: "Female", 
    tags: ["vocaloid", "music", "twin-tails"],
    claimValue: 100
  },
  {
    name: "Zero Two",
    series: "Darling in the FranXX",
    rarity: 5,
    imageUrl: "https://i.imgur.com/placeholder3.jpg", // Placeholder URL
    description: "The oni girl with pink hair and horns",
    gender: "Female",
    tags: ["oni", "pilot", "darling"],
    claimValue: 90
  },
  {
    name: "Rem",
    series: "Re:Zero",
    rarity: 4,
    imageUrl: "https://i.imgur.com/placeholder4.jpg", // Placeholder URL
    description: "The blue-haired maid of Roswaal Manor",
    gender: "Female",
    tags: ["maid", "oni", "loyal"],
    claimValue: 75
  },
  {
    name: "Asuka Langley",
    series: "Neon Genesis Evangelion",
    rarity: 4,
    imageUrl: "https://i.imgur.com/placeholder5.jpg", // Placeholder URL
    description: "The fiery Eva pilot",
    gender: "Female",
    tags: ["pilot", "tsundere", "eva"],
    claimValue: 80
  }
];

// Initialize sample characters in database
async function initializeCharacters() {
  try {
    const existingCount = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(characters);
    
    if (existingCount[0].count === 0) {
      console.log('🌱 Initializing sample characters...');
      await db.insert(characters).values(sampleCharacters);
      console.log('✅ Sample characters added to database');
    }
  } catch (error) {
    console.error('❌ Error initializing characters:', error);
  }
}

// Helper function to get or create user
async function getOrCreateUser(discordUser, guildId = null) {
  try {
    let [user] = await db.select().from(users).where(eq(users.discordId, discordUser.id));
    
    if (!user) {
      [user] = await db.insert(users).values({
        discordId: discordUser.id,
        username: discordUser.username,
        globalName: discordUser.globalName || discordUser.username
      }).returning();
      
      console.log(`👤 New user registered: ${discordUser.username} (${discordUser.id})`);
    }
    
    // Track guild membership for server-scoped leaderboards
    if (guildId) {
      const existingMembership = await db.select()
        .from(guildMembers)
        .where(and(
          eq(guildMembers.userId, user.id),
          eq(guildMembers.guildId, guildId)
        ));
        
      if (existingMembership.length === 0) {
        await db.insert(guildMembers).values({
          guildId: guildId,
          userId: user.id
        });
      } else {
        // Update last active time
        await db.update(guildMembers)
          .set({ lastActiveAt: new Date() })
          .where(and(
            eq(guildMembers.userId, user.id),
            eq(guildMembers.guildId, guildId)
          ));
      }
    }
    
    return user;
  } catch (error) {
    console.error('❌ Error getting/creating user:', error);
    throw error;
  }
}

// Character spawning function
async function spawnCharacter(channel) {
  try {
    const allCharacters = await db.select().from(characters);
    
    if (allCharacters.length === 0) {
      console.error('❌ No characters available to spawn');
      return;
    }
    
    // Weighted random selection based on rarity (lower rarity = higher chance)
    const weights = allCharacters.map(char => Math.pow(0.5, char.rarity - 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const random = Math.random() * totalWeight;
    
    let weightSum = 0;
    let selectedCharacter;
    
    for (let i = 0; i < allCharacters.length; i++) {
      weightSum += weights[i];
      if (random <= weightSum) {
        selectedCharacter = allCharacters[i];
        break;
      }
    }
    
    if (!selectedCharacter) {
      selectedCharacter = allCharacters[Math.floor(Math.random() * allCharacters.length)];
    }
    
    // Create spawn embed
    const rarityStars = '⭐'.repeat(selectedCharacter.rarity);
    const embed = new EmbedBuilder()
      .setTitle('🎲 A character has appeared!')
      .setDescription(`**${selectedCharacter.name}**\nFrom: ${selectedCharacter.series}\nRarity: ${rarityStars}`)
      .setColor(selectedCharacter.rarity === 5 ? '#FFD700' : selectedCharacter.rarity === 4 ? '#9932CC' : '#00BFFF')
      .setFooter({ text: 'React with 💖 to claim!' })
      .setTimestamp();
    
    if (selectedCharacter.imageUrl && selectedCharacter.imageUrl !== 'https://i.imgur.com/placeholder1.jpg') {
      embed.setImage(selectedCharacter.imageUrl);
    }
    
    const message = await channel.send({ embeds: [embed] });
    await message.react('💖');
    
    // Store spawn info persistently for reliable claiming
    const spawnTime = Date.now();
    activeSpawns.set(message.id, {
      characterId: selectedCharacter.id,
      spawnTime: spawnTime,
      guildId: channel.guild.id,
      channelId: channel.id,
      expiresAt: spawnTime + CLAIM_WINDOW,
      claimed: false
    });
    
    // Clean up expired spawn after claim window
    setTimeout(() => {
      activeSpawns.delete(message.id);
    }, CLAIM_WINDOW);
    
    console.log(`🎲 Spawned ${selectedCharacter.name} in ${channel.name}`);
    return message;
    
  } catch (error) {
    console.error('❌ Error spawning character:', error);
  }
}

// Slash command definitions
const commands = [
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your character collection profile')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('View another user\'s profile')
        .setRequired(false)),
        
  new SlashCommandBuilder()
    .setName('collection')
    .setDescription('View your character collection')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('View another user\'s collection')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number to view')
        .setRequired(false)),
        
  new SlashCommandBuilder()
    .setName('wishlist')
    .setDescription('Manage your character wishlist')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View your wishlist'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a character to your wishlist')
        .addStringOption(option =>
          option.setName('character')
            .setDescription('Character name to add')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a character from your wishlist')
        .addStringOption(option =>
          option.setName('character')
            .setDescription('Character name to remove')
            .setRequired(true))),
            
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for characters')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Character or series name to search for')
        .setRequired(true)),
        
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server leaderboards')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of leaderboard')
        .setRequired(false)
        .addChoices(
          { name: 'Collection Size', value: 'collection' },
          { name: 'Kakera', value: 'kakera' }
        )),
        
  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Manually spawn a character (debug command)'),
    
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Check your daily claim status and reset if needed')
];

// Register slash commands
async function registerCommands() {
  try {
    console.log('🔄 Registering slash commands...');
    
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    
    console.log('✅ Successfully registered slash commands');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

// Event handlers
client.once('ready', async () => {
  console.log('🤖 Discord Waifu Collection Bot is online!');
  console.log(`📊 Logged in as ${client.user.tag}`);
  console.log(`🏠 Serving ${client.guilds.cache.size} servers`);
  
  // Initialize database and commands
  await initializeCharacters();
  await registerCommands();
  
  // Set bot activity
  client.user.setActivity('with waifus | /profile', { type: 'PLAYING' });
  
  console.log('🚀 Bot initialization complete!');
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  try {
    const { commandName } = interaction;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const user = await getOrCreateUser(interaction.user, interaction.guild?.id);
    
    switch (commandName) {
      case 'profile':
        await handleProfileCommand(interaction, targetUser);
        break;
        
      case 'collection':
        await handleCollectionCommand(interaction, targetUser);
        break;
        
      case 'wishlist':
        await handleWishlistCommand(interaction, user);
        break;
        
      case 'search':
        await handleSearchCommand(interaction);
        break;
        
      case 'leaderboard':
        await handleLeaderboardCommand(interaction);
        break;
        
      case 'roll':
        await handleRollCommand(interaction);
        break;
        
      case 'daily':
        await handleDailyCommand(interaction, user);
        break;
        
      default:
        await interaction.reply({ content: '❌ Unknown command!', ephemeral: true });
    }
  } catch (error) {
    console.error('❌ Error handling interaction:', error);
    
    if (!interaction.replied) {
      await interaction.reply({ 
        content: '❌ An error occurred while processing your command. Please try again later.', 
        ephemeral: true 
      });
    }
  }
});

// Handle reactions for character claiming
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name !== '💖') return;
  
  const message = reaction.message;
  
  // Fetch message if partial (required for reliable reaction handling)
  if (message.partial) {
    try {
      await message.fetch();
    } catch (error) {
      console.error('❌ Failed to fetch message:', error);
      return;
    }
  }
  
  // Check if this is an active spawn using persistent tracking
  const spawn = activeSpawns.get(message.id);
  if (!spawn) return;
  
  try {
    const now = Date.now();
    
    // Check if spawn has expired
    if (now > spawn.expiresAt) {
      activeSpawns.delete(message.id);
      const reply = await message.channel.send('⏰ This character spawn has expired!');
      setTimeout(() => reply.delete().catch(() => {}), 5000);
      return;
    }
    
    // Race condition protection: atomic check and set
    if (spawn.claimed) {
      const reply = await message.channel.send(`😢 ${user}, this character has already been claimed!`);
      setTimeout(() => reply.delete().catch(() => {}), 5000);
      return;
    }
    spawn.claimed = true; // Mark as claimed immediately
    
    // Check claim cooldown
    const userId = user.id;
    const lastClaim = userClaimCooldowns.get(userId) || 0;
    
    if (now - lastClaim < CLAIM_COOLDOWN) {
      spawn.claimed = false; // Reset if cooldown blocks
      const remainingSeconds = Math.ceil((CLAIM_COOLDOWN - (now - lastClaim)) / 1000);
      const reply = await message.channel.send(`⏰ ${user}, please wait ${remainingSeconds} seconds before claiming again!`);
      setTimeout(() => reply.delete().catch(() => {}), 5000);
      return;
    }
    
    // Get or create user
    const dbUser = await getOrCreateUser(user, message.guild?.id);
    
    // Check daily claim limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dbUser.lastClaimReset < today) {
      // Reset daily claims
      await db.update(users)
        .set({ 
          dailyClaims: 0, 
          lastClaimReset: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(users.id, dbUser.id));
      dbUser.dailyClaims = 0;
    }
    
    if (dbUser.dailyClaims >= 10) {
      spawn.claimed = false; // Reset if daily limit reached
      const reply = await message.channel.send(`📅 ${user}, you've reached your daily claim limit (10/10)! Try again tomorrow.`);
      setTimeout(() => reply.delete().catch(() => {}), 7000);
      return;
    }
    
    // Check if character is already owned
    const existingCollection = await db.select()
      .from(collections)
      .where(and(
        eq(collections.userId, dbUser.id),
        eq(collections.characterId, spawn.characterId)
      ));
    
    if (existingCollection.length > 0) {
      // Give kakera compensation for duplicate
      await db.update(users)
        .set({ 
          kakera: dbUser.kakera + 5,
          updatedAt: new Date() 
        })
        .where(eq(users.id, dbUser.id));
        
      const reply = await message.channel.send(`🔄 ${user}, you already own this character! You received 5 kakera instead.`);
      setTimeout(() => reply.delete().catch(() => {}), 5000);
      
      // Remove spawn and set cooldown
      activeSpawns.delete(message.id);
      userClaimCooldowns.set(userId, now);
      return;
    }
    
    // Get character info
    const [character] = await db.select().from(characters).where(eq(characters.id, spawn.characterId));
    
    if (!character) {
      spawn.claimed = false; // Reset if character not found
      await message.channel.send('❌ Character not found in database!');
      return;
    }
    
    // Add to collection
    await db.insert(collections).values({
      userId: dbUser.id,
      characterId: character.id,
      claimNumber: dbUser.totalCharacters + 1
    });
    
    // Update user stats
    await db.update(users)
      .set({
        dailyClaims: dbUser.dailyClaims + 1,
        totalCharacters: dbUser.totalCharacters + 1,
        kakera: dbUser.kakera + character.claimValue,
        updatedAt: new Date()
      })
      .where(eq(users.id, dbUser.id));
    
    // Set claim cooldown and remove spawn
    userClaimCooldowns.set(userId, now);
    activeSpawns.delete(message.id);
    
    // Create success embed
    const rarityStars = '⭐'.repeat(character.rarity);
    const embed = new EmbedBuilder()
      .setTitle('💖 Character Claimed!')
      .setDescription(`**${user.username}** claimed **${character.name}**!\n\nFrom: ${character.series}\nRarity: ${rarityStars}\nKakera: +${character.claimValue}\nClaim #${dbUser.totalCharacters + 1}`)
      .setColor('#00FF00')
      .setTimestamp();
      
    if (character.imageUrl && character.imageUrl !== 'https://i.imgur.com/placeholder1.jpg') {
      embed.setThumbnail(character.imageUrl);
    }
    
    await message.channel.send({ embeds: [embed] });
    
    console.log(`💖 ${user.username} claimed ${character.name}`);
    
  } catch (error) {
    console.error('❌ Error handling character claim:', error);
    // Reset claim flag on error
    if (spawn) spawn.claimed = false;
    await message.channel.send('❌ An error occurred while claiming the character. Please try again.');
  }
});

// Command handlers
async function handleProfileCommand(interaction, targetUser) {
  const dbUser = await getOrCreateUser(targetUser);
  
  const userCollections = await db.select({ count: sql`count(*)`.mapWith(Number) })
    .from(collections)
    .where(eq(collections.userId, dbUser.id));
    
  const totalCollected = userCollections[0].count;
  
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${targetUser.username}'s Profile`)
    .setDescription(`**Collection Stats**\n\n🃏 Total Characters: ${totalCollected}\n💰 Kakera: ${dbUser.kakera}\n📅 Daily Claims: ${dbUser.dailyClaims}/10\n🎯 Wishlist Slots: ${dbUser.wishlistSlots}/10`)
    .setColor('#9932CC')
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();
    
  await interaction.reply({ embeds: [embed] });
}

async function handleCollectionCommand(interaction, targetUser) {
  await interaction.deferReply();
  
  const dbUser = await getOrCreateUser(targetUser);
  const page = interaction.options.getInteger('page') || 1;
  const itemsPerPage = 10;
  const offset = (page - 1) * itemsPerPage;
  
  const userCollections = await db.select({
    character: characters,
    claimedAt: collections.claimedAt,
    claimNumber: collections.claimNumber,
    married: collections.married
  })
  .from(collections)
  .innerJoin(characters, eq(collections.characterId, characters.id))
  .where(eq(collections.userId, dbUser.id))
  .orderBy(desc(collections.claimedAt))
  .limit(itemsPerPage)
  .offset(offset);
  
  if (userCollections.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle(`📚 ${targetUser.username}'s Collection`)
      .setDescription('No characters collected yet! Start claiming some characters.')
      .setColor('#FF6B6B');
      
    await interaction.editReply({ embeds: [embed] });
    return;
  }
  
  const description = userCollections.map((collection, index) => {
    const { character, claimNumber, married } = collection;
    const rarityStars = '⭐'.repeat(character.rarity);
    const marriageIcon = married ? '💒' : '';
    
    return `**${offset + index + 1}.** ${character.name} ${marriageIcon}\n*${character.series}* | ${rarityStars} | Claim #${claimNumber}`;
  }).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setTitle(`📚 ${targetUser.username}'s Collection (Page ${page})`)
    .setDescription(description)
    .setColor('#9932CC')
    .setFooter({ text: `Total: ${dbUser.totalCharacters} characters` });
    
  await interaction.editReply({ embeds: [embed] });
}

async function handleWishlistCommand(interaction, user) {
  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'view') {
    const userWishlists = await db.select({
      character: characters,
      addedAt: wishlists.addedAt
    })
    .from(wishlists)
    .innerJoin(characters, eq(wishlists.characterId, characters.id))
    .where(eq(wishlists.userId, user.id))
    .orderBy(desc(wishlists.addedAt));
    
    if (userWishlists.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('🌟 Your Wishlist')
        .setDescription('Your wishlist is empty! Use `/wishlist add <character>` to add characters.')
        .setColor('#FFD700');
        
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    const description = userWishlists.map((wishlist, index) => {
      const { character } = wishlist;
      const rarityStars = '⭐'.repeat(character.rarity);
      
      return `**${index + 1}.** ${character.name}\n*${character.series}* | ${rarityStars}`;
    }).join('\n\n');
    
    const embed = new EmbedBuilder()
      .setTitle('🌟 Your Wishlist')
      .setDescription(description)
      .setColor('#FFD700')
      .setFooter({ text: `${userWishlists.length}/${user.wishlistSlots} slots used` });
      
    await interaction.reply({ embeds: [embed] });
    
  } else if (subcommand === 'add') {
    const characterName = interaction.options.getString('character').trim();
    
    // Check current wishlist count
    const currentWishlistCount = await db.select({ count: sql`count(*)`.mapWith(Number) })
      .from(wishlists)
      .where(eq(wishlists.userId, user.id));
      
    if (currentWishlistCount[0].count >= user.wishlistSlots) {
      const embed = new EmbedBuilder()
        .setTitle('🌟 Wishlist Full')
        .setDescription(`Your wishlist is full (${user.wishlistSlots}/${user.wishlistSlots} slots)! Remove a character first.`)
        .setColor('#FF6B6B');
        
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    // Search for character by name
    const [character] = await db.select()
      .from(characters)
      .where(sql`LOWER(name) = ${characterName.toLowerCase()}`)
      .limit(1);
      
    if (!character) {
      const embed = new EmbedBuilder()
        .setTitle('🔍 Character Not Found')
        .setDescription(`No character found with the name "${characterName}". Try using the exact character name.`)
        .setColor('#FF6B6B');
        
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    // Check if already in wishlist
    const existingWishlist = await db.select()
      .from(wishlists)
      .where(and(
        eq(wishlists.userId, user.id),
        eq(wishlists.characterId, character.id)
      ));
      
    if (existingWishlist.length > 0) {
      const embed = new EmbedBuilder()
        .setTitle('🌟 Already in Wishlist')
        .setDescription(`**${character.name}** is already in your wishlist!`)
        .setColor('#FF6B6B');
        
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    // Add to wishlist
    await db.insert(wishlists).values({
      userId: user.id,
      characterId: character.id
    });
    
    const rarityStars = '⭐'.repeat(character.rarity);
    const embed = new EmbedBuilder()
      .setTitle('🌟 Added to Wishlist')
      .setDescription(`**${character.name}** from *${character.series}* has been added to your wishlist!\n\nRarity: ${rarityStars}`)
      .setColor('#00FF00');
      
    await interaction.reply({ embeds: [embed] });
    
  } else if (subcommand === 'remove') {
    const characterName = interaction.options.getString('character').trim();
    
    // Find character in user's wishlist
    const wishlistItem = await db.select({
      wishlist: wishlists,
      character: characters
    })
    .from(wishlists)
    .innerJoin(characters, eq(wishlists.characterId, characters.id))
    .where(and(
      eq(wishlists.userId, user.id),
      sql`LOWER(characters.name) = ${characterName.toLowerCase()}`
    ))
    .limit(1);
    
    if (wishlistItem.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('🌟 Not in Wishlist')
        .setDescription(`**${characterName}** is not in your wishlist or doesn't exist.`)
        .setColor('#FF6B6B');
        
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    const { character } = wishlistItem[0];
    
    // Remove from wishlist
    await db.delete(wishlists)
      .where(and(
        eq(wishlists.userId, user.id),
        eq(wishlists.characterId, character.id)
      ));
    
    const embed = new EmbedBuilder()
      .setTitle('🌟 Removed from Wishlist')
      .setDescription(`**${character.name}** has been removed from your wishlist.`)
      .setColor('#00FF00');
      
    await interaction.reply({ embeds: [embed] });
  }
}

async function handleSearchCommand(interaction) {
  await interaction.deferReply();
  
  const query = interaction.options.getString('query').toLowerCase();
  
  const searchResults = await db.select()
    .from(characters)
    .where(sql`LOWER(name) LIKE ${'%' + query + '%'} OR LOWER(series) LIKE ${'%' + query + '%'}`)
    .limit(10);
    
  if (searchResults.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('🔍 Search Results')
      .setDescription(`No characters found matching "${query}".`)
      .setColor('#FF6B6B');
      
    await interaction.editReply({ embeds: [embed] });
    return;
  }
  
  const description = searchResults.map((character, index) => {
    const rarityStars = '⭐'.repeat(character.rarity);
    
    return `**${index + 1}.** ${character.name}\n*${character.series}* | ${rarityStars}`;
  }).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setTitle(`🔍 Search Results for "${query}"`)
    .setDescription(description)
    .setColor('#00BFFF')
    .setFooter({ text: `Found ${searchResults.length} character(s)` });
    
  await interaction.editReply({ embeds: [embed] });
}

async function handleLeaderboardCommand(interaction) {
  await interaction.deferReply();
  
  const type = interaction.options.getString('type') || 'collection';
  const guildId = interaction.guild.id;
  
  let leaderboard;
  let title;
  let field;
  
  if (type === 'collection') {
    // Server-scoped collection leaderboard
    leaderboard = await db.select({
      username: users.username,
      totalCharacters: users.totalCharacters
    })
    .from(users)
    .innerJoin(guildMembers, eq(users.id, guildMembers.userId))
    .where(and(
      eq(guildMembers.guildId, guildId),
      sql`total_characters > 0`
    ))
    .orderBy(desc(users.totalCharacters))
    .limit(10);
    
    title = `🏆 ${interaction.guild.name} Collection Leaderboard`;
    field = 'totalCharacters';
  } else {
    // Server-scoped kakera leaderboard
    leaderboard = await db.select({
      username: users.username,
      kakera: users.kakera
    })
    .from(users)
    .innerJoin(guildMembers, eq(users.id, guildMembers.userId))
    .where(and(
      eq(guildMembers.guildId, guildId),
      sql`kakera > 0`
    ))
    .orderBy(desc(users.kakera))
    .limit(10);
    
    title = `💰 ${interaction.guild.name} Kakera Leaderboard`;
    field = 'kakera';
  }
  
  if (leaderboard.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription('No data available yet for this server! Start claiming characters to appear on the leaderboard.')
      .setColor('#FF6B6B');
      
    await interaction.editReply({ embeds: [embed] });
    return;
  }
  
  const description = leaderboard.map((entry, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
    const value = type === 'collection' ? `${entry[field]} characters` : `${entry[field]} kakera`;
    
    return `${medal} **${index + 1}.** ${entry.username} - ${value}`;
  }).join('\n');
  
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('#FFD700')
    .setFooter({ text: `Server-specific rankings for ${interaction.guild.name}` })
    .setTimestamp();
    
  await interaction.editReply({ embeds: [embed] });
}

async function handleRollCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await interaction.reply({ content: '❌ This command requires Manage Messages permission.', ephemeral: true });
    return;
  }
  
  await interaction.reply({ content: '🎲 Spawning a character...', ephemeral: true });
  await spawnCharacter(interaction.channel);
}

async function handleDailyCommand(interaction, user) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const embed = new EmbedBuilder()
    .setTitle('📅 Daily Status')
    .setDescription(`**Daily Claims:** ${user.dailyClaims}/10\n**Kakera:** ${user.kakera}\n\nClaims reset at midnight UTC.`)
    .setColor('#00BFFF')
    .setTimestamp();
    
  await interaction.reply({ embeds: [embed] });
}

// Auto-spawn characters in active channels
setInterval(async () => {
  const now = Date.now();
  
  if (now - lastSpawn >= SPAWN_COOLDOWN) {
    const guilds = client.guilds.cache;
    
    for (const [guildId, guild] of guilds) {
      try {
        // Find a suitable channel to spawn in
        const textChannels = guild.channels.cache.filter(channel => 
          channel.type === 0 && // Text channel
          channel.permissionsFor(guild.members.me).has(['SendMessages', 'AddReactions'])
        );
        
        if (textChannels.size > 0) {
          const randomChannel = textChannels.random();
          await spawnCharacter(randomChannel);
          break; // Only spawn in one server per interval
        }
      } catch (error) {
        console.error(`❌ Error spawning in guild ${guild.name}:`, error);
      }
    }
    
    lastSpawn = now;
  }
}, 60000); // Check every minute

// Error handling
client.on('error', error => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Connect to Discord
client.login(BOT_TOKEN);
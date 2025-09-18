import discord
from discord.ext import commands
import json
import re
import asyncio
import logging
import time
from collections import OrderedDict

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load settings
with open("Settings_Mudae.json") as jsonf:
    settings = json.load(jsonf)

# Bot setup
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.guild_messages = True

bot = commands.Bot(command_prefix='!', intents=intents)

# Mudae constants
MUDAE_ID = 432610292342587392

# Regex patterns for parsing Mudae messages
kak_finder = re.compile(r'\*\*??([0-9]+)\*\*<:kakera:469835869059153940>')
like_finder = re.compile(r'Likes\: \#??([0-9]+)')
claim_finder = re.compile(r'Claims\: \#??([0-9]+)')
pagination_finder = re.compile(r'\d+ / \d+')

class MudaeHelper:
    def __init__(self):
        self.series_list = settings.get("series_list", [])
        self.namelist = [name.lower() for name in settings.get("namelist", [])]
        self.emoji_list = settings.get("emoji_list", [])
        self.min_kak = settings.get("min_kak", 0)
    
    def get_kakera_value(self, text):
        """Calculate kakera value from Mudae message"""
        k_value = kak_finder.findall(text)
        like_value = like_finder.findall(text)
        claim_value = claim_finder.findall(text)
        
        if len(k_value):
            return int(k_value[0])
        elif len(like_value) or len(claim_value):
            LR = int(like_value[0]) if like_value else 0
            CR = int(claim_value[0]) if claim_value else 0
            CA = 1
            pkak = (LR + CR) / 2
            multi = 1 + (CA / 5500)
            return int((25000 * (pkak + 70) ** -0.75 + 20) * multi + 0.5)
        return 0
    
    def is_rolled_char(self, message):
        """Check if message is a valid Mudae character roll"""
        if not message.embeds:
            return False
        
        embed = message.embeds[0]
        if not embed.image or not embed.author:
            return False
        
        # Check for pagination (not a roll)
        if embed.footer and pagination_finder.search(str(embed.footer.text)):
            return False
        
        return True

mudae_helper = MudaeHelper()

@bot.event
async def on_ready():
    logger.info(f'{bot.user} has connected to Discord!')
    logger.info(f'Bot is in {len(bot.guilds)} guilds')
    
    # Sync slash commands
    try:
        synced = await bot.tree.sync()
        logger.info(f'Synced {len(synced)} slash commands')
    except Exception as e:
        logger.error(f'Failed to sync commands: {e}')

@bot.event
async def on_message(message):
    # Don't respond to bot messages
    if message.author.bot:
        return
    
    # Process commands
    await bot.process_commands(message)
    
    # Monitor Mudae rolls for analysis
    if message.author.id == MUDAE_ID and mudae_helper.is_rolled_char(message):
        await analyze_mudae_roll(message)

async def analyze_mudae_roll(message):
    """Analyze a Mudae character roll and provide information"""
    if not message.embeds:
        return
    
    embed = message.embeds[0]
    char_name = embed.author.name if embed.author else "Unknown"
    description = embed.description or ""
    
    # Calculate kakera value
    kak_value = mudae_helper.get_kakera_value(description)
    
    # Check if character is in wishlist
    is_wished = char_name.lower() in mudae_helper.namelist
    
    # Check if series is wanted
    wanted_series = any(series in description for series in mudae_helper.series_list)
    
    # Send analysis if notable
    if is_wished or wanted_series or kak_value >= mudae_helper.min_kak:
        analysis = f"📊 **Character Analysis**\n"
        analysis += f"**{char_name}**\n"
        analysis += f"💎 Kakera Value: {kak_value}\n"
        
        if is_wished:
            analysis += "⭐ This character is on your wishlist!\n"
        if wanted_series:
            analysis += "📺 This character is from a wanted series!\n"
        if kak_value >= mudae_helper.min_kak:
            analysis += f"💰 High value character (≥{mudae_helper.min_kak})!\n"
        
        await message.channel.send(analysis)

# Slash Commands
@bot.tree.command(name="mudae-roll", description="Roll for characters in Mudae")
async def mudae_roll(interaction: discord.Interaction, command: str = "w"):
    """Roll characters using Mudae commands"""
    valid_commands = ["w", "wg", "wa", "h", "hg", "ha", "m", "mg", "ma"]
    
    if command not in valid_commands:
        await interaction.response.send_message(
            f"Invalid command. Valid options: {', '.join(valid_commands)}", 
            ephemeral=True
        )
        return
    
    # Send the Mudae command
    await interaction.response.send_message(f"Rolling with `${command}`...")
    await interaction.followup.send(f"${command}")

@bot.tree.command(name="mudae-wishlist", description="Manage your Mudae wishlist")
async def mudae_wishlist(interaction: discord.Interaction, action: str, character: str = ""):
    """Manage wishlist"""
    if action == "add" and character:
        if character.lower() not in mudae_helper.namelist:
            mudae_helper.namelist.append(character.lower())
            await interaction.response.send_message(f"✅ Added **{character}** to wishlist!")
        else:
            await interaction.response.send_message(f"**{character}** is already on your wishlist!", ephemeral=True)
    
    elif action == "remove" and character:
        if character.lower() in mudae_helper.namelist:
            mudae_helper.namelist.remove(character.lower())
            await interaction.response.send_message(f"❌ Removed **{character}** from wishlist!")
        else:
            await interaction.response.send_message(f"**{character}** is not on your wishlist!", ephemeral=True)
    
    elif action == "list":
        if mudae_helper.namelist:
            wishlist = "\n".join([f"• {name.title()}" for name in mudae_helper.namelist])
            embed = discord.Embed(title="📝 Your Mudae Wishlist", description=wishlist, color=0x00ff00)
            await interaction.response.send_message(embed=embed)
        else:
            await interaction.response.send_message("Your wishlist is empty!", ephemeral=True)
    
    else:
        await interaction.response.send_message(
            "Usage: `/mudae-wishlist add <character>`, `/mudae-wishlist remove <character>`, or `/mudae-wishlist list`", 
            ephemeral=True
        )

@bot.tree.command(name="mudae-series", description="Manage wanted series")
async def mudae_series(interaction: discord.Interaction, action: str, series: str = ""):
    """Manage wanted series"""
    if action == "add" and series:
        if series not in mudae_helper.series_list:
            mudae_helper.series_list.append(series)
            await interaction.response.send_message(f"✅ Added **{series}** to wanted series!")
        else:
            await interaction.response.send_message(f"**{series}** is already in your wanted series!", ephemeral=True)
    
    elif action == "remove" and series:
        if series in mudae_helper.series_list:
            mudae_helper.series_list.remove(series)
            await interaction.response.send_message(f"❌ Removed **{series}** from wanted series!")
        else:
            await interaction.response.send_message(f"**{series}** is not in your wanted series!", ephemeral=True)
    
    elif action == "list":
        if mudae_helper.series_list:
            series_list = "\n".join([f"• {series}" for series in mudae_helper.series_list])
            embed = discord.Embed(title="📺 Your Wanted Series", description=series_list, color=0x0099ff)
            await interaction.response.send_message(embed=embed)
        else:
            await interaction.response.send_message("You have no wanted series!", ephemeral=True)
    
    else:
        await interaction.response.send_message(
            "Usage: `/mudae-series add <series>`, `/mudae-series remove <series>`, or `/mudae-series list`", 
            ephemeral=True
        )

@bot.tree.command(name="mudae-config", description="View current Mudae configuration")
async def mudae_config(interaction: discord.Interaction):
    """Show current configuration"""
    embed = discord.Embed(title="⚙️ Mudae Bot Configuration", color=0xff9900)
    embed.add_field(name="Min Kakera Value", value=mudae_helper.min_kak, inline=True)
    embed.add_field(name="Wishlist Count", value=len(mudae_helper.namelist), inline=True)
    embed.add_field(name="Wanted Series Count", value=len(mudae_helper.series_list), inline=True)
    
    if mudae_helper.namelist:
        wishlist_preview = ", ".join(mudae_helper.namelist[:5])
        if len(mudae_helper.namelist) > 5:
            wishlist_preview += f" (+{len(mudae_helper.namelist)-5} more)"
        embed.add_field(name="Wishlist Preview", value=wishlist_preview, inline=False)
    
    if mudae_helper.series_list:
        series_preview = ", ".join(mudae_helper.series_list[:3])
        if len(mudae_helper.series_list) > 3:
            series_preview += f" (+{len(mudae_helper.series_list)-3} more)"
        embed.add_field(name="Series Preview", value=series_preview, inline=False)
    
    await interaction.response.send_message(embed=embed)

# Prefix Commands (alternative to slash commands)
@bot.command(name="roll")
async def roll_command(ctx, cmd: str = "w"):
    """Roll for characters using prefix command"""
    valid_commands = ["w", "wg", "wa", "h", "hg", "ha", "m", "mg", "ma"]
    
    if cmd not in valid_commands:
        await ctx.send(f"Invalid command. Valid options: {', '.join(valid_commands)}")
        return
    
    await ctx.send(f"${cmd}")

@bot.command(name="help-mudae")
async def help_mudae(ctx):
    """Show help for Mudae commands"""
    help_text = """
🎮 **Mudae Discord Bot Commands**

**Slash Commands:**
• `/mudae-roll <command>` - Roll characters (w, wg, wa, h, hg, ha, m, mg, ma)
• `/mudae-wishlist add/remove/list <character>` - Manage your wishlist
• `/mudae-series add/remove/list <series>` - Manage wanted series
• `/mudae-config` - View current configuration

**Prefix Commands:**
• `!roll <command>` - Roll characters
• `!help-mudae` - Show this help message

**Features:**
• 📊 Automatic character analysis
• 💎 Kakera value calculation
• ⭐ Wishlist notifications
• 📺 Series tracking
"""
    
    embed = discord.Embed(title="🎮 Mudae Bot Help", description=help_text, color=0x00ff00)
    await ctx.send(embed=embed)

# Run the bot
if __name__ == "__main__":
    bot.run(settings['token'])
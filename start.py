#!/usr/bin/env python3
"""
Quick start script for Mudae Discord Bot
This will run the recommended bot version directly
"""
import subprocess
import sys

def main():
    print("🚀 Starting Mudae Discord Bot...")
    print("📝 Using: mudae_discord_bot.py (recommended version)")
    print("⚙️  Reading configuration from Settings_Mudae.json")
    print()
    print("Bot will start in 3 seconds...")
    print("Press Ctrl+C to stop the bot")
    print("=" * 50)
    
    try:
        subprocess.run([sys.executable, "mudae_discord_bot.py"], check=True)
    except KeyboardInterrupt:
        print("\n✋ Bot stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Bot crashed with error code {e.returncode}")
        print("💡 Tip: Check your Settings_Mudae.json for correct Discord token")
    except FileNotFoundError:
        print("\n❌ mudae_discord_bot.py not found")

if __name__ == "__main__":
    main()
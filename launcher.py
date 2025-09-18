#!/usr/bin/env python3
"""
Mudae Bot Launcher
Choose which bot version to run
"""
import os
import sys
import subprocess

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def show_menu():
    clear_screen()
    print("=" * 50)
    print("    MUDAE DISCORD BOT LAUNCHER")
    print("=" * 50)
    print()
    print("Choose which bot to run:")
    print()
    print("1. 🤖 Modern Bot (discord.py) - RECOMMENDED")
    print("   File: mudae_discord_bot.py")
    print("   ✅ Stable, well-tested")
    print("   ✅ Full Discord API support")
    print()
    print("2. 🔧 Alternative Bot (discord.py)")
    print("   File: mudaebot3.py") 
    print("   ⚠️  May have configuration issues")
    print()
    print("3. 🛠️  Legacy Bot (discum)")
    print("   File: MudaeAutoBot.py")
    print("   ⚠️  Uses older selfbot library")
    print("   ⚠️  May have compatibility issues")
    print()
    print("4. ❌ Exit")
    print()
    print("=" * 50)

def run_bot(bot_file):
    print(f"\n🚀 Starting {bot_file}...")
    print("Press Ctrl+C to stop the bot\n")
    try:
        subprocess.run([sys.executable, bot_file], check=True)
    except KeyboardInterrupt:
        print("\n✋ Bot stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Bot crashed with error code {e.returncode}")
        print("Check your Settings_Mudae.json configuration")
    except FileNotFoundError:
        print(f"\n❌ File {bot_file} not found")

def main():
    # Check if running in interactive mode
    if not sys.stdin.isatty():
        print("Non-interactive mode detected. Starting recommended bot...")
        run_bot("mudae_discord_bot.py")
        return
    
    while True:
        show_menu()
        
        try:
            choice = input("Enter your choice (1-4): ").strip()
            
            if choice == "1":
                run_bot("mudae_discord_bot.py")
            elif choice == "2":
                run_bot("mudaebot3.py")
            elif choice == "3":
                run_bot("MudaeAutoBot.py")
            elif choice == "4":
                print("\n👋 Goodbye!")
                break
            else:
                input("\n❌ Invalid choice. Press Enter to continue...")
                continue
                
        except (KeyboardInterrupt, EOFError):
            print("\n\n👋 Goodbye!")
            break
        
        input("\nPress Enter to return to menu...")

if __name__ == "__main__":
    main()
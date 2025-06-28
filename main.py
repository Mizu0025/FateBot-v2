from bot_logic.irc_bot import ImageGenBot
from configuration.config import IRC_SERVER, IRC_PORT, CHANNEL, BOT_NICK, BOT_USER, BOT_TRIGGER

def main():
    """Main entry point for the IRC bot application."""
    try:
        server_list = [(IRC_SERVER, IRC_PORT)]
        
        bot = ImageGenBot(
            bot_nick=BOT_NICK,
            bot_user=BOT_USER,
            channel=CHANNEL,
            trigger_word=BOT_TRIGGER,
            server_list=server_list
        )
        bot.start() # Assuming your bot has a start method that connects and runs
    except Exception as e:
        print(f"An unhandled error occurred in main: {e}")
    finally:
        print("IRC Bot application stopped.")

if __name__ == "__main__":
    main()
import logging
from bot_logic.irc_bot import ImageGenBot
from configuration.config import IRC_SERVER, IRC_PORT, CHANNEL, BOT_NICK, BOT_USER, BOT_TRIGGER

def main():
    """Main entry point for the IRC bot application."""
    logging.basicConfig(
        filename="irc_bot.log",
        encoding="utf-8",
        filemode="a",
        format="{asctime} - {levelname} - {message}",
        style="{", 
        datefmt="%d-%m-%Y %H:%M", 
        level=logging.INFO)
    logging.getLogger(__name__)
    logging.info("Starting FateBot...")

    try:
        server_list = [(IRC_SERVER, IRC_PORT)]
        
        bot = ImageGenBot(
            bot_nick=BOT_NICK,
            bot_user=BOT_USER,
            channel=CHANNEL,
            trigger_word=BOT_TRIGGER,
            server_list=server_list
        )
        bot.start()
    except Exception as e:
        logging.critical(f"An unhandled error occurred in main: {e}")
    finally:
        logging.info("FateBot has stopped.")

if __name__ == "__main__":
    main()
from config import IRC_CONFIG
from comfyui import generate_image
from text_filter import extract_prompts
import socket

class IRCBot:
    def __init__(self, server, port, channel, bot_nick, bot_user, trigger_word):
        self.server = server
        self.port = port
        self.channel = channel
        self.bot_nick = bot_nick
        self.bot_user = bot_user
        self.trigger_word = trigger_word
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    def connect(self) -> None:
        """Connect to the IRC server and join the channel."""
        print(f"Connecting to {self.server}:{self.port}...")
        self.socket.connect((self.server, self.port))
        
        # Send NICK and USER in sequence
        self.socket.sendall(f"NICK {self.bot_nick}\r\n".encode("utf-8"))
        self.socket.sendall(f"USER {self.bot_user} 0 * :{self.bot_nick}\r\n".encode("utf-8"))
        
        # Wait for server welcome message before joining
        while True:
            response = self.socket.recv(2048).decode("utf-8").strip()
            
            # Check for successful registration (numeric 001)
            if f"001 {self.bot_nick}" in response:
                # Now join the channel
                self.socket.sendall(f"JOIN {self.channel}\r\n".encode("utf-8"))
                print(f"Joined channel {self.channel}")
                break
            
            # Respond to PINGs during connection
            if response.startswith("PING"):
                self.socket.sendall(f"PONG {response.split()[1]}\r\n".encode("utf-8"))
                print("PONG sent to server")

    def listen(self) -> None:
        """Listen for messages in the channel and respond to the trigger word."""
        while True:
            response = self.socket.recv(2048).decode("utf-8").strip("\r\n")
            
            # Check for messages containing the trigger word
            if f"PRIVMSG {self.channel}" in response:
                print(f"Received: {response}")
                user = response.split("!")[0][1:]  # Extract the user
                message = response.split(f"PRIVMSG {self.channel} :")[1]  # Extract the message

                if self.trigger_word in message:
                    self.handle_image_generation(user, message)

    def handle_image_generation(self, user, message) -> None:
            """Handle the image generation process."""
            try:
                # Extract the prompt and negative prompt
                filteredPrompt = extract_prompts(message)

                # Generate the image
                webImages = generate_image(filteredPrompt)

                # Handle the trigger (image generation)
                for image in webImages:
                    self.handle_image_reply(user, image)

            except Exception as errorMsg:
                self.handle_image_reply(user, errorMsg)

    def handle_image_reply(self, user, message) -> None:
        """Send a message back to the channel notifying the image request user."""
        response_message = f"{user}: {message}"
        self.send_message(response_message)

    def send_message(self, message) -> None:
        """Send a message to the channel."""
        self.socket.sendall(f"PRIVMSG {self.channel} :{message}\r\n".encode("utf-8"))
        print(f"Sent: {message}")

if __name__ == "__main__":
    bot = IRCBot(
        server=IRC_CONFIG["server"],
        port=IRC_CONFIG["port"],
        channel=IRC_CONFIG["channel"],
        bot_nick=IRC_CONFIG["bot_nick"],
        bot_user=IRC_CONFIG["bot_user"],
        trigger_word=IRC_CONFIG['bot_trigger']
    )
    bot.connect()
    bot.listen()

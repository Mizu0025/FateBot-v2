# FateBot IRC Client

A lightweight IRC bot client that connects to an external **Image Generation Service** to facilitate AI image generation using ComfyUI.

## Architecture

This bot behaves as a proxy. It handles:
- **IRC Lifecycle**: Connection, channel joining, and message listening.
- **Command Routing**: Identifies help, model listing, and image generation requests.
- **Service Communication**: Delegates prompt parsing and image generation to a separate microservice.

## Features

- **Lightweight**: Minimal dependencies (IRC framework, logger, env management).
- **Asynchronous**: Non-blocking image generation with queue status updates.
- **Standalone**: Can connect to any compatible Image Service API.

## Commands

- `!fate --help` - Shows help information and usage guide.
- `!fate --models` - Lists AI models available on the connected service.
- `!fate <prompt> [flags]` - Generates an image.
  - *Example*: `!fate a sunset cityscape --width=1024 --height=768 --model=paSanctuary`

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the project:
   ```bash
   npm run build
   ```

## Configuration

The bot is configured via a `.env` file (or `.env.dev` for development):

- `SERVER` - IRC server address.
- `PORT` - IRC server port.
- `NICK` - Bot nickname.
- `CHANNEL` - IRC channel to join.
- `TRIGGER_WORD` - The keyword used to trigger the bot (e.g., `!fate`).
- `IMAGE_SERVICE_URL` - URL of the external Image Generation Service (e.g., `http://localhost:8000`).

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Related Projects

- **[FateBot Image Service](https://github.com/example/fatebot-image-service)**: The Python-based microservice that handles the actual ComfyUI orchestration and image processing.
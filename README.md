# FateBot TypeScript

A TypeScript implementation of the FateBot IRC bot for image generation using ComfyUI.

## Features

- **IRC Bot Integration**: Connects to IRC channels and responds to commands
- **Text Parsing**: Parses user prompts with parameters (width, height, model, negative prompts)
- **Image Generation**: Generates images using ComfyUI via WebSocket
- **Image Grid Creation**: Automatically creates grid layouts from multiple generated images
- **Async Operations**: Non-blocking image generation that doesn't interrupt bot responsiveness
- **Modular Architecture**: Clean, maintainable code structure

## Commands

- `fatebot --help` - Shows help information
- `fatebot --models` - Lists available models
- `fatebot <prompt> --width=<w> --height=<h> --model=<m> --no=<negative_prompt>` - Generates an image

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Configuration

The bot uses environment variables for configuration:

- `COMFYUI_ADDRESS` - ComfyUI server address (default: `hayate:8188`)
- `COMFYUI_DOMAIN_PATH` - Domain path for images (default: `mock_domain_path`)
- `COMFYUI_FOLDER_PATH` - Folder path for images (default: `mock_folder_path`)

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

### Watch Mode (Development)
```bash
npm run watch
```

## Project Structure

```
src/
├── bot.ts                    # Main bot file
├── types/
│   └── index.ts             # TypeScript interfaces
├── config/
│   ├── constants.ts         # Configuration constants
│   └── model-loader.ts      # Model configuration loading
├── text-filter/
│   └── prompt-parser.ts     # Text parsing logic
└── image-generation/
    ├── comfyui-client.ts    # ComfyUI WebSocket client
    ├── workflow-loader.ts   # Workflow data loading
    ├── prompt-processor.ts  # Prompt processing
    ├── image-generator.ts   # Main image generation orchestrator
    └── image-grid.ts        # Image grid generation
```

## Dependencies

- `irc-framework` - IRC client library
- `ws` - WebSocket client for ComfyUI
- `sharp` - Image processing for grid creation
- `uuid` - Unique ID generation
- `@types/node` - Node.js TypeScript definitions

## Architecture

The bot is designed with a modular, async-first architecture:

1. **Text Parsing**: Extracts prompt parameters from user messages
2. **Model Loading**: Loads model configurations from JSON files
3. **Workflow Processing**: Processes ComfyUI workflow data
4. **WebSocket Communication**: Connects to ComfyUI server for image generation
5. **Image Saving**: Saves generated images to local storage
6. **Grid Creation**: Creates grid layouts from multiple images

All operations are asynchronous and non-blocking, ensuring the bot remains responsive while generating images.

## Example Usage

```
User: fatebot a beautiful landscape --width=1024 --height=768 --model=paSanctuary --no=ugly, blurry
Bot: User: Starting image generation...
Bot: User: Your image is ready! https://example.com/images/123456.0.png
```

## Development

The codebase is written in TypeScript with strict type checking. All modules are designed to be testable and maintainable.

### Building
```bash
npm run build
```

### Running Tests
The project includes comprehensive tests for all components. Run tests to verify functionality:
```bash
npm run build && node dist/test-comfyui.js
``` 
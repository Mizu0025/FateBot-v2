# FateBot TypeScript

A TypeScript implementation of the FateBot IRC bot for image generation using ComfyUI.

## Features

- **IRC Bot Integration**: Connects to IRC channels and responds to commands (with optional SASL authentication)
- **Text Parsing**: Parses user prompts with parameter flags, including short aliases (e.g. `-w` for `--width`)
- **Image Generation**: Generates images using ComfyUI via WebSocket, and can delete them again via `--delete` (a single batch by id, or `--delete all`)
- **Image Grid Creation**: Automatically composes grid layouts from batches of generated images (output is WebP)
- **Prompt Queue + Background Worker**: Every request is queued and processed by a background worker, so the bot stays responsive and requests are handled one at a time (queue is capped at 16 pending requests)
- **On-Demand ComfyUI**: ComfyUI runs as a user systemd service that the bot starts on demand and stops automatically after it has been idle, so it is never holding GPU memory for no reason
- **Error Handling**: Distinguishes user errors (bad input) from system errors, classifies generation failures (offline / backend / timeout / internal), and automatically retries transient failures once
- **Structured Logging**: Winston-based logs, optionally written to `./logs` with rotation
- **Modular Architecture**: Clean, maintainable code structure with full unit-test coverage (Vitest)

## Commands

The bot activates on messages in its configured channel that contain the trigger word.

### Image generation

```
<trigger> <prompt> [--width=<w>] [--height=<h>] [--model=<m>] [--no <negative_prompt>] [--count=<n>] [--seed=<s>]
```

Flags also accept short aliases: `-w`, `-h`, `-m`, `-n` (or `--negative`), `-c`, `-s`.

### Control commands

These flags are detected anywhere in a trigger message and handled as commands:

| Flag | Description |
|------|-------------|
| `--help` | Shows prompt syntax and an example |
| `--models` | Lists the available model names (from `modelConfiguration.json`) |
| `--start-comfyui` | Starts the ComfyUI service immediately (no-op if already running) |
| `--stop-comfyui` | Stops the ComfyUI service to free GPU memory (starts again on the next image request) |
| `--delete <prompt_id>` | Deletes one generated batch by its prompt id (e.g. `8cc05ada-…`) |
| `--delete all` | Clears every image in the art folder |

Flags are matched on a **whole whitespace-delimited token** (case-insensitive), so a prompt that merely *contains* a flag word (e.g. "a picture of a --help page") is still treated as a generation request.

### Generation defaults

| Parameter | Default |
|-----------|---------|
| Model | `paSanctuary` |
| Width / Height | `1024` / `1024` |
| Count | `4` (four images composed into one grid) |
| Output format | `webp` |

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

## ComfyUI Requirements

The bot expects ComfyUI to be available as a **user systemd service** run by the same user as the bot (unit name configurable via `COMFYUI_UNIT_NAME`). A minimal unit template:

```ini
# ~/.config/systemd/user/comfyui.service
[Unit]
Description=ComfyUI (start/stop controlled by FateBot)
After=network-online.target

[Service]
WorkingDirectory=/path/to/comfyui
ExecStart=/path/to/your/comfyui-launch.sh
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
loginctl enable-linger <botuser>   # keep the user session alive for --user units
```

The bot itself never assumes the service is running: it probes ComfyUI's `/system_stats` endpoint and starts the service on demand. To enable linger on boot automatically, see your distribution's documentation for `loginctl enable-linger`.

## Configuration

Configuration is read from environment variables, validated with `envalid`, and available via a `.env` file in the project root.

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` with your settings.

### Available Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER` | IRC server address | `address` |
| `PORT` | IRC server port (use `6697` for TLS) | `6667` |
| `CHANNEL` | IRC channel to join | `#channel` |
| `NICK` | Bot's nickname | `nick` |
| `TRIGGER_WORD` | Command trigger word | `!trigger` |
| `SASL_ACCOUNT` | SASL account name (optional) | (unset) |
| `SASL_PASSWORD` | SASL password (optional) | (unset) |
| `COMFYUI_ADDRESS` | ComfyUI server address | `comfyAddress` |
| `COMFYUI_PORT` | ComfyUI server port | `8188` |
| `COMFYUI_DOMAIN_PATH` | Public URL prefix reported back to IRC users | `mock_domain_path` |
| `COMFYUI_FOLDER_PATH` | Local path where images are saved | `/path/to/files/` |
| `COMFYUI_WORKFLOW_PATH` | Path to the ComfyUI workflow JSON | `src/workflows/workflow.json` |
| `COMFYUI_UNIT_NAME` | Name of the ComfyUI user systemd unit (without `.service`) | `comfyui` |
| `COMFYUI_IDLE_MINUTES` | Idle minutes before the bot stops ComfyUI to free VRAM | `10` |
| `COMFYUI_START_TIMEOUT_SECONDS` | Max seconds to wait for ComfyUI to become ready after start | `120` |
| `LOG_LEVEL` | Winston log level (`error`, `warn`, `info`, `debug`) | `info` |
| `LOG_TO_FILE` | Also write JSON logs to `./logs/combined.log` and `./logs/error.log` (rotated, 5 files) | `false` |

Models are configured in `modelConfiguration.json` (checkpoint, VAE, workflow, sampler settings and default prompts per model name).

## Usage

### Development (build then run)
```bash
npm run dev
```

### Watch Mode (Development)
```bash
npm run watch
```

### Production
```bash
npm run build
npm start
```

## Project Structure

```
src/
├── bot.ts                         # Entry point
├── bot-client.ts                  # IRC connection + component wiring
├── shutdown.ts                    # Process signal + error handlers (graceful shutdown)
├── config/
│   ├── env.ts                     # envalid environment validation
│   ├── constants.ts               # BOT_CONFIG, COMFYUI_CONFIG, defaults, help text
│   ├── logger.ts                  # Winston logger (console + optional file)
│   ├── model-loader.ts            # Model configuration loading
│   └── runtime-config.ts          # Runtime-mutable settings (default model)
├── handlers/
│   ├── message-handler.ts         # Routes incoming messages to commands or generation
│   └── command-handler.ts         # --help, --models, start/stop ComfyUI, generation
├── image-generation/
│   ├── comfyui-client.ts          # ComfyUI WebSocket client
│   ├── workflow-loader.ts         # Workflow data loading
│   ├── prompt-processor.ts        # Prompt preparation for the workflow
│   ├── image-generator.ts         # Generation orchestrator (batch + grid)
│   ├── image-grid.ts              # Grid/montage composition (sharp)
│   └── filename-utils.ts          # Filename + public URL helpers
├── managers/
│   ├── comfyui-service-manager.ts # Start/stop/readiness of the ComfyUI user service
│   └── inactivity-manager.ts      # Stops ComfyUI after the queue has been idle
├── queue/
│   ├── queue.ts                   # Prompt queue with idle callbacks
│   └── worker.ts                  # Background worker that drains the queue
├── text-filter/
│   └── prompt-parser.ts           # Prompt + flag parsing
├── types/
│   ├── index.ts                   # Shared TypeScript interfaces
│   ├── errors.ts                  # FateBotError base, UserError, SystemError
│   └── irc.ts                     # IRC client/event type declarations
├── utils/
│   ├── error-utils.ts             # Failure classification (offline/backend/timeout/internal)
│   └── artwork-deleter.ts         # Deletes generated images (one batch by id, or "all")
```

## Dependencies

- `irc-framework` - IRC client
- `ws` - WebSocket client for ComfyUI
- `sharp` - Image processing (grid composition, WebP output)
- `uuid` - Unique ID generation
- `winston` - Structured logging
- `envalid` - Environment variable validation
- `dotenv` / `dotenv-cli` - `.env` file loading
- `ts-node` - Direct TypeScript execution for `npm start`

## Architecture

The bot is modular and async-first, with a strict separation between *receiving* requests and *doing* the work:

1. **Message intake**: `bot-client.ts` maintains the IRC connection (TLS, SASL, reconnectable logging of socket/IRC-level errors) and hands `message` events to `message-handler.ts`
2. **Routing + parsing**: `message-handler.ts` routes command flags (`--help`, `--models`, `--start-comfyui`, `--stop-comfyui`, `--delete`) or hands the prompt to `command-handler.ts`, which parses flags via `prompt-parser.ts` and adds a `PromptQueueItem` to the queue
3. **Background worker**: `worker.ts` drains the queue one item at a time — the only component that talks to ComfyUI for generation:
   - `comfyui-service-manager.ts` probes `/system_stats`; if ComfyUI is down it starts the user systemd service and polls until it reports ready (or stops the service and fails, to avoid a crash loop)
   - `image-generator.ts` runs the workflow via WebSocket (batch generation, then `image-grid.ts` composes multiple images into one grid)
   - Transient failures (connection refused/reset, timeouts) are retried exactly once; other failures are classified (`error-utils.ts`) and reported to the channel with a short reason
4. **Idle shutdown**: `inactivity-manager.ts` listens to the queue's idle signal and stops the ComfyUI service after `COMFYUI_IDLE_MINUTES` with no activity, freeing GPU memory for the rest of the machine
5. **Graceful shutdown**: `shutdown.ts` wires `SIGINT`/`SIGTERM` (plus `uncaughtException`/`unhandledRejection` for defence-in-depth) into `FateBot.shutdown()`, which stops the generation worker, disables the inactivity timer, and quits the IRC connection — an in-flight generation always finishes and is reported first

All operations are asynchronous and non-blocking, so the bot remains responsive while images are generating.

## Example Usage

```
User: !fate a beautiful landscape --width=1024 --height=768 --model=paSanctuary --no=ugly, blurry --count=2
Bot:  Mizu: Starting image generation... You are #1 in the queue.
Bot:  Mizu: Your image is ready! http://your.domain/path/1a2b3c..._0.webp
```

If ComfyUI was stopped, you will see an additional line while it comes up:

```
Bot:  Mizu: ComfyUI was offline — starting it up now, generation will take a little longer...
```

## Development

The codebase is written in TypeScript with strict type checking. Every module has a co-located unit test, written with Vitest (`*.test.ts`). Formatting and linting use Biome (`biome.json`):

- The codebase style is preserved (4-space indent, single quotes, semicolons).
- A couple of Biome rules are deliberately disabled (documented here):
    - **`noStaticOnlyClass` (off)** — several collaborators (`ImageGrid`, `PromptParser`, `WorkflowLoader`, …) are pure namespaces of static helpers. Refactoring each to a plain namespace object would keep the same call shape (`X.method`) but drop the class identity the project uses as a conceptual module; keeping the class is simpler than that churn. Inside those static helpers, sibling calls use the explicit class name (`ImageGrid.determineGridLayout`), so `noThisInStatic` (still on) reports nothing.
    - **`useArrowFunction` (off, in `**/*.test.ts` only)** — Vitest constructor mocks must be `function` expressions, not arrows, because production code does `new ComfyUIClient(...)` and the mock it replaces must be constructible under `new` (arrows throw a `TypeError`). Biome can't detect that usage, so we scope the disable to test files in `biome.json` and leave the rule fully enforced on production code.

Everything else in Biome's recommended presets is on.

### Building
```bash
npm run build        # compiles src/ (production) to dist/
```

### Type-checking
```bash
npm run typecheck    # full type-check of production + test code (no emit)
```

### Running Tests
```bash
npm test
```

### Lint / Format
```bash
npm run lint        # check (read-only)
npm run lint:fix    # check + apply safe fixes
npm run format      # format only
```

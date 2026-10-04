# FateBot-v2 — Anti-pattern audit & upgrade plan

Snapshot: HEAD `49a89e8` (merge of `chore/vitest-biome-migration`), baseline **136/136 tests passing** (`vitest run`, 12:45 AEDT, Node v24.21.0).

Scope: every `src/**` module read in full. Items are ordered by severity — **P0 = correctness / resource safety, P1 = robustness & operability, P2 = maintainability**. Each item: what's wrong (with file:line evidence), desired state, and a verifiable acceptance criterion. A separate item is one fixable unit — do not bundle across multiple items in a single PR.

Conventions from `fatebot-ops` skill still apply: strict layer split (worker owns ComfyUI), tests co-located (`*.test.ts`), `npm run build` + `npm test` + `npm run lint` + `npm run typecheck` all green, README updated in the same PR.

---

## P0 — correctness / resource safety

### P0-1 · `comfyui-client.ts` — WebSocket handlers leak and hang
**Where:** `connectWebSocket()` (L101–145) and `getImagesFromWebSocket()` (L153–233).
- `connectWebSocket` attaches `open` / `error` / `close` listeners but only resolves on `open` — if the server accepts the TCP connection but never completes the IRC-adjacent handshake, or simply hangs, **the promise never settles** and the worker is blocked forever.
- `getImagesFromWebSocket` resolves on `executing{node:null}` but the `'message'` listener is **never removed**. A second generation on the *same* socket would receive the same frames twice. It also registers **fresh** `error` and `close` listeners on top of the ones from `connectWebSocket`.
- If the socket `'close'`s mid-job, the timeout is cleared but the promise is **never rejected** → hang until the 5-minute timeout (only) fires.

**Desired:**
- Attach a connect-timeout (10 s) with `once`-semantics via `ws.once('open')` / `ws.once('error')` and `.off()` / remove them in a `finally`.
- In `getImagesFromWebSocket`, keep **one** `message` listener registered via `ws.once`-style handling or remove it on resolve/reject/timeout; remove `error`/`close` listeners on settle.
- Make the 300 s timeout configurable (see P1-7).

**Acceptance:** new tests in `comfyui-client.test.ts`: (a) socket that never opens → rejects within connect timeout; (b) two consecutive generations reuse one socket with zero duplicate frames; (c) mid-job socket close → rejects with `SystemError`, does not hang.

### P0-2 · `comfyui-service-manager.ts` — TOCTOU race in `ensureRunning`
**Where:** L49–85. `ensureRunning` is not serialized across callers. Scenario: worker generates item A (takes > `START_TIMEOUT_SECONDS`) while a previous failed `ensureRunning` is still in its poll loop. Both believe they own the service; when the loser times out it calls `stopService()`, **killing a service the other generation is using**.
Same class of bug: `stop()` from `--stop-comfyui` or the inactivity timer racing `ensureRunning` mid-generation.

**Desired:** an in-process `mutex` (or `ensureRunning: Promise<boolean> | null` single-flight guard) so at most one "start + wait-for-ready" window is open at any time. `stop()` remains fire-and-forget, but a `stop` that lands while an `ensureRunning` is in flight either waits for it or is a logged no-op.

**Acceptance:** `comfyui-service-manager.test.ts` gains a test that invokes two concurrent `ensureRunning()` calls with a slow `isRunning()` and asserts `startService` is called exactly once and the service is **not** stopped afterward.

### P0-3 · `worker.ts` / `bot.ts` — no stop, no shutdown
- `GenerationWorker.loop()` is `while (true)` — no `stop()`.
- `bot.ts` has no `process.on('uncaughtException' | 'unhandledRejection')` and no `SIGTERM/SIGINT` handler.
- `InactivityManager.stop()` is dead — nothing calls it in production.

**Desired:** `Worker.stop()` that drains (or abandons, with a log line) the current item and breaks the loop; `bot` registers a single `shutdown()` invoked by SIGTERM/SIGINT that stops worker, inactivity manager, and the IRC client, and closes any open `ComfyUIClient`; uncaught handlers log + keep running (defence-in-depth — the worker loop already has a catch-all).

**Acceptance:** `worker.test.ts` covers `stop()` semantics (in-flight item is not silently dropped); a new integration test drives `bot`'s shutdown path on `SIGINT`.

### P0-4 · `image-generator.ts` — `saveImageFiles` swallows per-image failures
**Where:** L112–125. A `sharp` or `writeFileSync` failure on image 3 of 4 logs and continues; the remaining 3 images proceed to grid generation with **no warning to the user**. Worse: if only **1** image saves successfully out of 4, `generateImage` returns that single image as if the request succeeded.

**Desired:** count failures; if 1+ (and not all) failed, log at `warn` and the worker's success message says "3 of 4 saved — one failed, see logs". If **all** failed, throw a `SystemError` (let P0-6's retry do its job).

**Acceptance:** new test drives `sharp` failure on 3 of 4 images and asserts (a) partial grid is produced with a `warn` log, (b) all-fail throws `SystemError`.

### P0-5 · `error-utils.ts` — 4xx classified as "retryable"
**Where:** L70–72. `retryable: status < 500` means a 400/401/403/404 re-run is scheduled — a guaranteed second identical GPU burn. Only 408 (Request Timeout) and 429 (Too Many Requests) among 4xx are meaningfully retryable.

**Desired:** `retryable: status === 408 || status === 429 || status >= 500`.

**Acceptance:** `error-utils.test.ts` — each of 400/404/408/429/500/502 has an explicit expected `retryable` value.

### P0-6 · `prompt-parser.ts` — no sanity bounds on width/height/count
A prompt like `--width 65536 --height 65536 --count 128` currently parses cleanly, enqueues, and asks the GPU to allocate ~54 GB of VRAM. Same for a `--count 10000` DoS.

**Desired:** in `applyModifier`, clamp/validate against hard limits (suggest `32 ≤ w,h ≤ 8192`, `1 ≤ count ≤ 64`). On violation throw `UserError` (already handled in `command-handler`'s catch).

**Acceptance:** `prompt-parser.test.ts` cases for each field at `limit-1`, `limit`, `limit+1`, and `0` / negative.

### P0-7 · `message-handler.ts` — command routing matches substring anywhere, case-sensitively
**Where:** L40 `this.commands.find((c) => message.includes(c.flag))`.
- Any prompt containing the *literal* text `--delete all` (e.g. "a banner for a new --delete all button") triggers a destructive path.
- Case handling is inconsistent: routing is `--stop-comfyui` case-sensitive, but `extractDeleteArg` uses `/i`, and the parser's `findModifierMatches` regex is also `/i`.
- The trigger-word filter uses `.includes()`, so a prompt that *contains* `!fate` but does not *start* with it still routes, while `PromptParser.extractPrompts` then requires `startsWith` and throws `UserError` — inconsistent.

**Desired:**
- Anchor flags: split the message on whitespace, require a flag to be a whole token. A prompt word that merely *contains* `--delete` must not match.
- Unify on case-insensitive matching end-to-end.
- Either make the trigger-word test `startsWith`-based (align with `PromptParser`) or drop the `startsWith` requirement there.

**Acceptance:** `message-handler.test.ts` cases: (a) `!fate a banner that says "--delete all"` → generation, not delete; (b) `!fate --START-COMFYUI` → start; (c) `!fate a --helpful picture` → generation, not help.

### P0-8 · `queue.ts` — unbounded queue, no backpressure
Anyone in the channel (or a bot-loop) can queue unlimited generation jobs; `items` grows without bound. There is no per-nick rate limit either.

**Desired:** `MAX_QUEUE_LENGTH` (suggested 16) in `constants.ts` / validated in `env.ts`. `addTask` rejects beyond the cap with a `UserError`; the handler reports "queue full, try again later". Optionally a per-nick sliding window (5 / 60 s) as a follow-up in the same PR.

**Acceptance:** `queue.test.ts` — 17th item throws `UserError`; position report reflects the cap.

---

## P1 — robustness & operability

### P1-1 · Blocking fs I/O on the IRC path
`artwork-deleter.ts` (`readdirSync` / `statSync` / `unlinkSync`) runs synchronously in `handleDeleteImages`, and the inactivity timer / `ensureRunning` probe use `fetch` but `ModelLoader` and `WorkflowLoader` use `readFileSync` per generation (per queued item). A batch delete of a large folder stalls IRC responsiveness for the entire unlink pass.

**Desired:** `fs.promises.readdir/stat/unlink` in `artwork-deleter` (make `deleteArtworkTarget` async; the `command-handler` call site already `await`s its sibling methods, trivial to align). `ModelLoader` and `WorkflowLoader` switch to `fs.promises` and cache parsed results keyed by path + mtime.

**Acceptance:** `artwork-deleter.test.ts` uses `fs.promises` mocks; `model-loader.test.ts` / `workflow-loader.test.ts` assert the cache short-circuits a second call within the same mtime window.

### P1-2 · Raw IRC traffic logged unconditionally + SASL exposure
`bot-client.ts` L63–65: `console.log` on every `raw` event, not gated by `LOG_LEVEL`. The `raw` stream includes the SASL `AUTH` line on every reconnect.

**Desired:** `logger.debug` (respecting `LOG_LEVEL`), and redact any line matching `/^AUTH /` or containing the SASL password.

**Acceptance:** `bot-client.test.ts`-style test (or manual check) shows: `LOG_LEVEL=info` → no raw lines; `LOG_LEVEL=debug` → raw lines present, `AUTH` redacted.

### P1-3 · TLS via hardcoded port 6697
`bot-client.ts` L108: `const isTlsPort = Number(BOT_CONFIG.PORT) === 6697;` silently disables TLS for any other port and hardcodes the assumption. Also `rejectUnauthorized: false` is a LAN tradeoff — fine, but the *port* check should not be.

**Desired:** add `TLS: boolean` to `env.ts` (default: `PORT === 6697`) and read it from `BOT_CONFIG`.

**Acceptance:** `bot-client.test.ts` verifies `connect` is called with `tls: true` when `TLS=true` and `PORT=7000`.

### P1-4 · `auto_reconnect: false` — single drop is permanent
`bot-client.ts` L119. Comment says "so logs stay clean" — but the bot stays disconnected forever after any server-side restart until a manual systemd restart. Combined with P1-2's raw logs, there is zero operational visibility while offline.

**Desired:** `auto_reconnect: true` (or implement a small backoff on `close`), and log connection state transitions at `warn`.

**Acceptance:** a scripted test disconnects the server and asserts the bot re-joins within 60 s.

### P1-5 · `envalid` gaps + `START_POLL_INTERVAL_MS` hardcoded
- `LOG_LEVEL` and `LOG_TO_FILE` read directly from `process.env` in `logger.ts` — not validated, not in `.env.example`, bypasses the single source of truth (`env.ts`).
- `START_POLL_INTERVAL_MS: 2000` is hardcoded in `constants.ts` while every other service tunable is env-driven.

**Desired:** add `LOG_LEVEL: str({ default: 'info' })`, `LOG_TO_FILE: booleanOrUndefined()`, `COMFYUI_START_POLL_INTERVAL_MS: posInt({ default: 2000 })` to `env.ts`, mirror in `constants.ts`, update `.env.example`.

**Acceptance:** `env.test.ts` has a case asserting all three new keys are present with expected defaults.

### P1-6 · Dead / half-wired surface
- `COMFYUI_WORKFLOW_PATH` declared in `env.ts` + `constants.ts`, **never read anywhere** — `WorkflowLoader.loadWorkflowByName` builds the path via `__dirname`. Either wire it (per-model override? global?) or remove it.
- `ComfyUIClient.queuePrompt` is `Promise<string | null>` and callers null-check, but the implementation only ever returns a string. Make it `Promise<string>` and drop the null handling.
- `handleComfyuiStatus` exists and is tested (`command-handler.test.ts:138`) but is **not registered** in `message-handler.commands` — either add a `--status` flag or delete the method + its tests.
- `RuntimeConfig.defaultModel` is writable with a `set`-side log line but **nothing calls the setter** — either expose a `--default-model <name>` command (natural home in `command-handler`) or delete the class.

**Acceptance:** every removed symbol has a single-file commit with a grep-verified zero-referencer count; newly registered flag has a `message-handler.test.ts` routing case.

---

## P2 — maintainability

### P2-1 · `ts-expect-error` on `irc-framework` import
`bot-client.ts` L2 suppresses a module-typing error. Replace with `src/types/irc-framework.d.ts` (or a local `.d.ts` module declaration) so the import type-checks and the suppression disappears.

### P2-2 · Static-helper class pattern
`ImageGenerator`, `ImageGrid`, `ModelLoader`, `WorkflowLoader`, `PromptProcessor`, `PromptParser` are all static-only classes. This is kept intentionally per project rules (Biome `noStaticOnlyClass` override) — **do not change**. But it does block dependency-injecting a fake `ImageGenerator` in worker tests; if P0-1's refactor is painful, consider injecting a small `GenerationDriver` interface into `GenerationWorker` as a seam.

### P2-3 · `__dirname`-relative file lookups
`ModelLoader` (L20, L43) and `WorkflowLoader.loadWorkflowByName` (L50) resolve `modelConfiguration.json` and `src/workflows/*.json` via `join(__dirname, ...)`. This silently breaks if `dist/` layout changes. Move both to env-driven paths (P1-5's `COMFYUI_WORKFLOW_PATH` is already declared but unused — that's the natural home).

### P2-4 · `generateRandomSeed` not seeded deterministically
`prompt-processor.ts` L132 uses `Math.random()`. Fine for a LAN bot, but for reproducibility (and testability of seed-handling tests) consider `crypto.randomInt(1, 1_000_001)` or a seeded `mulberry32` when `--seed` is passed twice by the same user.

### P2-5 · `prompt-parser.ts` — trigger-word strip can corrupt the prompt
L25 `message.replace(BOT_CONFIG.TRIGGER_WORD, '').trim()` removes the trigger word **wherever it first appears**, even mid-prompt. If the user's actual prompt contains the trigger word (e.g. `!fate a picture of the word "!fate"`), the inner occurrence is stripped, not the leading one. Use a regex with `^` anchor.

### P2-6 · `worker.ts` — retry only once, no jitter
`generateWithRetry` does exactly one blind retry. For P1-4's flaky-network case, a 2-3 retry schedule with random backoff (2 s, 8 s ± 2 s) is a small, safe win.

### P2-7 · `image-grid.ts` derives `promptId` from filename rather than receiving it
`generateImageGrid(filepaths)` (L118) re-derives the prompt id from the first path. `generateImage` (which owns the `promptId`) could pass it in, removing the re-parse and the shared assumption.

---

## Verification checklist (per PR)

- `npm run lint` → 0 warnings
- `npm run typecheck` → clean on both `tsconfig.build.json` and `tsconfig.tests.json`
- `npm run build` → clean
- `npm test` → 136/136 **+ new** tests passing
- `README.md`: command table + project-structure tree updated in the same PR
- Deploy: `systemctl --user restart fatebot.service` → `active`, journal shows re-join with no throw

Out-of-scope by design (do **not** change): the `as const`-mutable `COMFYUI_CONFIG` test shim, the static-helper class pattern (Biome override), `UserError` / `SystemError` shape (tests depend on it), `sharp` choice, `winston` choice.

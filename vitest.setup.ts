import { vi } from 'vitest';

// Silence the winston console transport for the whole suite. Vitest does NOT
// mock console.* on its own (unlike Jest), so logger calls from un-mocked
// modules (e.g. winston in worker/prompt-parser) would print straight to
// stdout otherwise. Pinning them to vi.fn() also keeps any per-file console
// spy (vi.spyOn(console, ...)) safe to restore, since it falls back to a
// quiet stub rather than the real stdout.
for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    console[method] = vi.fn();
}

// Mock cleanup is owned by each test file via its own afterEach/resetAllMocks/
// clearAllMocks — no global restore here, so per-file spies stay intact.

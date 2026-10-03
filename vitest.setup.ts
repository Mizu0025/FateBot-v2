// Mock console methods to suppress noisy test output.
// vitest auto-mocks console.* inside tests, but this pins them explicitly so
// that even if tests call mockRestore() on their own spies, the console
// methods revert to these mocks rather than the original stdout.
import { vi } from 'vitest';

console.log = vi.fn();
console.info = vi.fn();
console.warn = vi.fn();
console.error = vi.fn();
console.debug = vi.fn();

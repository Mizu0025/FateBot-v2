// Mock console methods to suppress noisy test output
// This ensures that even if tests call mockRestore() on their own spies,
// the console methods will revert to these mocks rather than the original stdout.
console.log = jest.fn();
console.info = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();
console.debug = jest.fn();


module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/src/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/src/jest.setup.ts'],
};

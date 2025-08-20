
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/src/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};

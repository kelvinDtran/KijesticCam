/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^electron$': '<rootDir>/src/__tests__/mocks/electron.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        module: 'CommonJS',
        moduleResolution: 'Node',
      },
    },
  },
}

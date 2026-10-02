module.exports = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: require('path').join(__dirname, 'coverage'),
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: { global: { branches: 72.72, functions: 84.61, lines: 84.61, statements: 84.84 } },
  resetMocks: true,
  restoreMocks: true,
  rootDir: './src',
  testEnvironment: 'jsdom',
  preset: 'ts-jest'
};

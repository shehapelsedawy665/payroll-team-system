module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['backend/**/*.js', 'routes/**/*.js'],
  coverageThreshold: { global: { lines: 70 } }
};
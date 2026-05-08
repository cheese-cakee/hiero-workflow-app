// SPDX-License-Identifier: Apache-2.0

/**
 * Jest configuration for the Hiero Workflow App.
 *
 * Uses the standard jest runner with clear output and coverage
 * thresholds appropriate for a mission-critical automation system.
 */

module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/modules/escalation/**',
    '!src/modules/inactivity/**',
    '!src/modules/onboarding/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
};

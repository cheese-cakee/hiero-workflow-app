// SPDX-License-Identifier: Apache-2.0

/**
 * ESLint configuration for the Hiero Workflow App.
 *
 * Enforces consistent style across the codebase without being overly
 * prescriptive. The goal is readability and maintainability for a
 * long-term open-source project.
 */

const globals = require('globals');

module.exports = [
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // Possible Problems
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-unreachable': 'error',

      // Suggestions
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',

      // Layout & Formatting
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'max-len': ['warn', { code: 100, ignoreComments: true, ignoreStrings: true }],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
    },
  },
];

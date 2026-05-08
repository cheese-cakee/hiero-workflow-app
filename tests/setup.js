// SPDX-License-Identifier: Apache-2.0

/**
 * Jest setup file.
 *
 * Configures the test environment before each test suite runs.
 * Currently minimal — expands here when global mocks or timers are needed.
 */

// Increase default timeout for integration-style tests.
jest.setTimeout(10000);

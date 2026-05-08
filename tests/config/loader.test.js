// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the configuration loader.
 *
 * Mocks Probot's context.config() to simulate repository configs,
 * then verifies that the loader correctly validates, merges, and
 * falls back to safe defaults.
 */

const { loadConfig, deepMerge } = require('../../src/config/loader');
const { safeDefaults } = require('../../src/config/defaults');

describe('loadConfig', () => {
  let mockContext;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockContext = {
      config: jest.fn(),
    };
  });

  test('returns safe defaults when config file is missing', async () => {
    mockContext.config.mockResolvedValue(null);

    const config = await loadConfig(mockContext, mockLogger);

    expect(config.assignment).toBeDefined();
    expect(config.assignment.enabled).toBe(false);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'No hiero-bot.yml found; using safe defaults',
    );
  });

  test('returns safe defaults when context.config() throws', async () => {
    mockContext.config.mockRejectedValue(new Error('Network timeout'));

    const config = await loadConfig(mockContext, mockLogger);

    expect(config.assignment.enabled).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { error: 'Network timeout' },
      'Failed to load hiero-bot.yml',
    );
  });

  test('validates and merges a fully specified config', async () => {
    const repoConfig = {
      assignment: {
        enabled: true,
        max_open_assignments: 5,
      },
      audit: {
        enabled: true,
        log_all_decisions: false,
      },
    };

    mockContext.config.mockResolvedValue(repoConfig);

    const config = await loadConfig(mockContext, mockLogger);

    expect(config.assignment.enabled).toBe(true);
    expect(config.assignment.max_open_assignments).toBe(5);
    // Defaults preserved for unspecified properties.
    expect(config.assignment.cross_repo_prerequisites).toBe(true);
    expect(config.audit.log_all_decisions).toBe(false);
    expect(config.audit.include_reason_in_comments).toBe(true);
  });

  test('deep-merges partially specified nested objects', async () => {
    const repoConfig = {
      assignment: {
        enabled: true,
        status_labels: {
          ready: 'custom-ready',
        },
      },
    };

    mockContext.config.mockResolvedValue(repoConfig);

    const config = await loadConfig(mockContext, mockLogger);

    expect(config.assignment.status_labels.ready).toBe('custom-ready');
    expect(config.assignment.status_labels.in_progress).toBe(
      safeDefaults.assignment.status_labels.in_progress,
    );
    expect(config.assignment.status_labels.blocked).toBe(
      safeDefaults.assignment.status_labels.blocked,
    );
  });

  test('falls back to safe defaults when config is invalid', async () => {
    const repoConfig = {
      assignment: {
        enabled: 'not-a-boolean',
      },
    };

    mockContext.config.mockResolvedValue(repoConfig);

    const config = await loadConfig(mockContext, mockLogger);

    expect(config.assignment.enabled).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ errors: expect.any(Array) }),
      'Invalid hiero-bot.yml; using safe defaults',
    );
  });

  test('preserves _extends for Probot inheritance resolution', async () => {
    const repoConfig = {
      _extends: '.github',
      assignment: { enabled: true },
    };

    mockContext.config.mockResolvedValue(repoConfig);

    const config = await loadConfig(mockContext, mockLogger);

    expect(config._extends).toBe('.github');
    expect(config.assignment.enabled).toBe(true);
  });
});

describe('deepMerge', () => {
  test('merges nested objects while preserving defaults', () => {
    const target = { a: { b: 1, c: 2 } };
    const source = { a: { c: 3 } };

    const result = deepMerge(target, source);

    expect(result.a.b).toBe(1);
    expect(result.a.c).toBe(3);
  });

  test('replaces arrays instead of concatenating', () => {
    const target = { items: [1, 2] };
    const source = { items: [3] };

    const result = deepMerge(target, source);

    expect(result.items).toEqual([3]);
  });

  test('handles null by deleting the key', () => {
    const target = { a: { b: 1 } };
    const source = { a: null };

    const result = deepMerge(target, source);

    expect(result).not.toHaveProperty('a');
  });

  test('returns source when source is a primitive', () => {
    const target = { value: 1 };
    const source = { value: 'string' };

    const result = deepMerge(target, source);

    expect(result.value).toBe('string');
  });

  test('does not mutate the target object', () => {
    const target = { a: { b: 1 } };
    const source = { a: { b: 2 } };

    deepMerge(target, source);

    expect(target.a.b).toBe(1);
  });
});

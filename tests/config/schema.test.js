// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the configuration schema validator.
 *
 * Ensures that valid configurations pass, invalid configurations produce
 * clear errors, and default values are correctly injected by Ajv.
 */

const { createConfigValidator } = require('../../src/config/schema');
const { safeDefaults } = require('../../src/config/defaults');

describe('createConfigValidator', () => {
  let validate;

  beforeEach(() => {
    validate = createConfigValidator();
  });

  describe('valid configurations', () => {
    test('accepts an empty object and applies defaults', () => {
      const config = {};
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(config.assignment).toBeDefined();
      expect(config.audit).toBeDefined();
    });

    test('accepts a fully populated configuration', () => {
      const config = {
        assignment: {
          enabled: true,
          commands: ['/assign', '/unassign', '/finalize'],
          max_open_assignments: 3,
          cross_repo_prerequisites: false,
          skill_levels: {
            'good-first-issue': {
              max_completions: 3,
              prerequisites: null,
            },
            beginner: {
              prerequisites: {
                label: 'good first issue',
                min_completed: 2,
              },
            },
          },
          status_labels: {
            ready: 'status: ready',
            in_progress: 'status: wip',
          },
        },
        pr_quality: {
          enabled: true,
          checks: {
            dco: false,
          },
        },
        escalation: {
          enabled: true,
          rules: [
            { label: 'security', notify_team: 'security-team' },
          ],
        },
      };

      const valid = validate(config);
      expect(valid).toBe(true);
      expect(config.assignment.enabled).toBe(true);
    });

    test('accepts _extends for org-level inheritance', () => {
      const config = {
        _extends: '.github',
      };
      const valid = validate(config);
      expect(valid).toBe(true);
    });
  });

  describe('default value injection', () => {
    test('injects top-level module defaults when module is omitted', () => {
      const config = {};
      validate(config);
      // The schema injects empty objects and boolean defaults.
      // Deep merging with safeDefaults happens in the config loader.
      expect(config.assignment).toBeDefined();
      expect(config.assignment.enabled).toBe(false);
      expect(config.assignment.max_open_assignments).toBe(2);
    });

    test('injects audit defaults when module is omitted', () => {
      const config = {};
      validate(config);
      expect(config.audit.enabled).toBe(true);
    });

    test('injects nested defaults for checks when pr_quality is empty', () => {
      const config = { pr_quality: {} };
      validate(config);
      expect(config.pr_quality.checks.dco).toBe(true);
    });
  });

  describe('invalid configurations', () => {
    test('rejects unknown top-level properties', () => {
      const config = { unknown_module: {} };
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors.some(e => e.message.includes('additional properties'))).toBe(true);
    });

    test('rejects typo in module name (assignment vs assingment)', () => {
      const config = { assingment: { enabled: true } };
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    test('rejects negative max_open_assignments', () => {
      const config = {
        assignment: {
          enabled: true,
          max_open_assignments: -1,
        },
      };
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    test('rejects string where boolean is expected', () => {
      const config = {
        assignment: {
          enabled: 'yes',
        },
      };
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    test('rejects rule missing required notify_team', () => {
      const config = {
        escalation: {
          enabled: true,
          rules: [{ label: 'security' }],
        },
      };
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    test('rejects label exceeding max length', () => {
      const config = {
        assignment: {
          enabled: true,
          status_labels: {
            ready: 'a'.repeat(101),
          },
        },
      };
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    test('rejects too many escalation rules', () => {
      const config = {
        escalation: {
          enabled: true,
          rules: Array.from({ length: 51 }, (_, i) => ({
            label: `label-${i}`,
            notify_team: 'team',
          })),
        },
      };
      const valid = validate(config);
      expect(valid).toBe(false);
    });
  });

  describe('error message quality', () => {
    test('produces a human-readable error for type mismatch', () => {
      const config = { assignment: { enabled: 42 } };
      validate(config);
      expect(validate.errors.length).toBeGreaterThan(0);
      expect(validate.errors[0].message).toContain('boolean');
    });
  });
});

// SPDX-License-Identifier: Apache-2.0

/**
 * JSON Schema definitions for the hiero-bot.yml configuration file.
 *
 * The schema is the single source of truth for what a repository may configure.
 * Every module defines its own sub-schema, which is assembled into the top-level
 * document. Ajv validates user-provided config against this schema so that
 * typos, missing fields, or invalid types are caught before any automation runs.
 *
 * Design principles:
 * - Every module has an `enabled` boolean. Defaults to false (opt-in).
 * - `additionalProperties: false` on each module to catch typos.
 * - `minLength` and `maxLength` guards on user-facing strings (comments, labels).
 * - Arrays have sensible `maxItems` limits to prevent accidental config bloat.
 */

const Ajv = require('ajv');

// ─── Reusable Schema Fragments ───────────────────────────────────────────────

const labelSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 100,
};

const positiveIntegerSchema = {
  type: 'integer',
  minimum: 1,
  maximum: 365,
};

// ─── Module Schemas ──────────────────────────────────────────────────────────

const assignmentModuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: false },
    commands: {
      type: 'array',
      items: { type: 'string', enum: ['/assign', '/unassign', '/finalize'] },
      maxItems: 10,
      default: ['/assign', '/unassign'],
    },
    max_open_assignments: { type: 'integer', minimum: 1, maximum: 10, default: 2 },
    cross_repo_prerequisites: { type: 'boolean', default: true },
    skill_levels: {
      type: 'object',
      default: {},
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        properties: {
          max_completions: { type: 'integer', minimum: 1, maximum: 100 },
          prerequisites: {
            type: ['object', 'null'],
            additionalProperties: false,
            properties: {
              label: labelSchema,
              min_completed: { type: 'integer', minimum: 1, maximum: 100 },
            },
          },
        },
      },
    },
    status_labels: {
      type: 'object',
      default: {},
      additionalProperties: false,
      properties: {
        ready: labelSchema,
        in_progress: labelSchema,
        blocked: labelSchema,
        needs_review: labelSchema,
        needs_revision: labelSchema,
      },
    },
  },
};

const prQualityModuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: false },
    unified_dashboard: { type: 'boolean', default: true },
    checks: {
      type: 'object',
      default: {},
      additionalProperties: false,
      properties: {
        dco: { type: 'boolean', default: true },
        gpg: { type: 'boolean', default: true },
        merge_conflict: { type: 'boolean', default: true },
        linked_issue: { type: 'boolean', default: true },
        conventional_title: { type: 'boolean', default: true },
        linked_issue_assigned: { type: 'boolean', default: true },
      },
    },
    auto_label: { type: 'boolean', default: true },
    draft_explainer: { type: 'boolean', default: true },
  },
};

const inactivityModuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: false },
    warn_after_days: { ...positiveIntegerSchema, default: 5 },
    close_after_days: { ...positiveIntegerSchema, default: 7 },
    blocked_checkin_days: { ...positiveIntegerSchema, default: 30 },
    exempt_labels: {
      type: 'array',
      items: labelSchema,
      maxItems: 20,
      default: ['status: blocked'],
    },
    skip_labels: {
      type: 'array',
      items: labelSchema,
      maxItems: 20,
      default: ['status: needs review'],
    },
  },
};

const onboardingModuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: false },
    welcome_on_first_pr: { type: 'boolean', default: true },
    welcome_message: { type: 'string', maxLength: 2000 },
    check_profile: { type: 'boolean', default: true },
  },
};

const escalationModuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: false },
    rules: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: labelSchema,
          notify_team: { type: 'string', minLength: 1, maxLength: 100 },
          message: { type: 'string', maxLength: 500 },
        },
        required: ['label', 'notify_team'],
      },
    },
  },
};

const progressionModuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: false },
    recommend_on_merge: { type: 'boolean', default: true },
    track_levels: { type: 'boolean', default: true },
  },
};

const aiPlanningModuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: false },
    trigger_label: labelSchema,
    model: { type: 'string', maxLength: 100 },
  },
};

const aiReviewModuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: false },
    model: { type: 'string', maxLength: 100 },
    max_files: { type: 'integer', minimum: 1, maximum: 50 },
  },
};

const auditModuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: true },
    log_all_decisions: { type: 'boolean', default: true },
    include_reason_in_comments: { type: 'boolean', default: true },
  },
};

// ─── Top-Level Schema ────────────────────────────────────────────────────────

const hieroBotConfigSchema = {
  $id: 'hiero-bot-config',
  type: 'object',
  additionalProperties: false,
  properties: {
    _extends: { type: 'string' },
    // Each module has `default: {}` so that Ajv injects an empty object
    // when the module is omitted, which then triggers nested defaults.
    assignment: { ...assignmentModuleSchema, default: {} },
    pr_quality: { ...prQualityModuleSchema, default: {} },
    inactivity: { ...inactivityModuleSchema, default: {} },
    onboarding: { ...onboardingModuleSchema, default: {} },
    escalation: { ...escalationModuleSchema, default: {} },
    progression: { ...progressionModuleSchema, default: {} },
    ai_planning: { ...aiPlanningModuleSchema, default: {} },
    ai_review: { ...aiReviewModuleSchema, default: {} },
    audit: { ...auditModuleSchema, default: {} },
  },
};

// ─── Validator Factory ───────────────────────────────────────────────────────

/**
 * Creates an Ajv instance compiled with the Hiero bot configuration schema.
 *
 * @returns {import('ajv').ValidateFunction} A compiled validator function.
 */
function createConfigValidator() {
  const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    strict: true,
  });

  return ajv.compile(hieroBotConfigSchema);
}

module.exports = {
  createConfigValidator,
  hieroBotConfigSchema,
};

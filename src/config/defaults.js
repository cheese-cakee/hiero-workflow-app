// SPDX-License-Identifier: Apache-2.0

/**
 * Hardcoded safe defaults for the Hiero Workflow App.
 *
 * When a repository provides no configuration, or when a module is omitted,
 * these defaults ensure the App behaves safely: every module is disabled
 * except the audit logger, which is always on so that maintainers can see
 * what the App is (or is not) doing.
 *
 * The defaults object mirrors the shape of the validated configuration so
 * that downstream code can read `config.assignment.enabled` without
 * checking for undefined.
 */

const safeDefaults = {
  assignment: {
    enabled: false,
    commands: ['/assign', '/unassign'],
    max_open_assignments: 2,
    cross_repo_prerequisites: true,
    skill_levels: {},
    status_labels: {
      ready: 'status: ready for dev',
      in_progress: 'status: in progress',
      blocked: 'status: blocked',
      needs_review: 'status: needs review',
      needs_revision: 'status: needs revision',
    },
  },
  pr_quality: {
    enabled: false,
    unified_dashboard: true,
    checks: {
      dco: true,
      gpg: true,
      merge_conflict: true,
      linked_issue: true,
      conventional_title: true,
      linked_issue_assigned: true,
    },
    auto_label: true,
    draft_explainer: true,
  },
  inactivity: {
    enabled: false,
    warn_after_days: 5,
    close_after_days: 7,
    blocked_checkin_days: 30,
    exempt_labels: ['status: blocked'],
    skip_labels: ['status: needs review'],
  },
  onboarding: {
    enabled: false,
    welcome_on_first_pr: true,
    welcome_message: '',
    check_profile: true,
  },
  escalation: {
    enabled: false,
    rules: [],
  },
  progression: {
    enabled: false,
    recommend_on_merge: true,
    track_levels: true,
  },
  ai_planning: {
    enabled: false,
    trigger_label: 'needs-plan',
    model: 'gpt-4o-mini',
  },
  ai_review: {
    enabled: false,
    model: 'gpt-4o-mini',
    max_files: 10,
  },
  audit: {
    enabled: true,
    log_all_decisions: true,
    include_reason_in_comments: true,
  },
};

module.exports = {
  safeDefaults,
};

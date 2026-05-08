# Migration Guide — Old Bot Scripts to Hiero Workflow App

This guide walks through migrating from the original `hiero-sdk-cpp` bot scripts
(GitHub Actions-based) to the unified Hiero Workflow App (Probot-based GitHub App).

---

## What Changes

| | Old System | New System |
|---|---|---|
| **Deployment** | 10 GitHub Actions workflows | 1 GitHub App |
| **Scripts** | 8 scattered JS files in `.github/scripts/` | 2 config-driven modules |
| **Config** | 15+ hardcoded constants scattered across files | 1 `.github/hiero-bot.yml` per repo |
| **Labels** | Hardcoded in `helpers/constants.js` | Configurable in YAML with JSON Schema validation |
| **PR comments** | 5+ separate bot comments per PR | 1 persistent dashboard comment |
| **Triggers** | `pull_request_target`, `issue_comment`, `schedule`, `workflow_dispatch` | Native webhooks (`pull_request`, `issue_comment.created`, `pull_request_review.submitted`, `schedule.repository`) |
| **Permissions** | `pull-requests: write`, `issues: write`, `contents: read`, `checks: write` per workflow | App-level permissions set once |
| **Runners** | `hiero-client-sdk-linux-large` self-hosted | Any Node.js ≥20 (Fly.io / Docker) |
| **Tests** | 11 separate test scripts in `scripts/tests/` | 1 Jest suite (138 tests, 94% coverage) |
| **Audit** | Console logs in Actions output | Structured audit log + optional public comments |

---

## What Stays the Same

- **`/assign`, `/unassign` commands**: Exact same behavior — comment on an issue, bot responds
- **All 14 labels**: Same label names (`status: ready for dev`, `skill: good first issue`, etc.)
- **Skill hierarchy**: GFI → Beginner → Intermediate → Advanced, with the same prerequisite counts
- **DCO / GPG / merge conflict / issue link checks**: Same logic, same heuristics
- **Assignment limit with needs-review bypass**: Same GraphQL-based bypass for contributors with open PRs
- **Inactivity warnings (5-day) and closures (7-day)**: Same thresholds, same idempotent comment pattern
- **Blocked issue 30-day check-in**: Same behavior

---

## Step-by-Step Migration

### Step 1: Install the App

[Create the App from the manifest](https://github.com/settings/apps/new?url=https://raw.githubusercontent.com/cheese-cakee/hiero-workflow-app/master/app.yml)
and install it on your repository.

### Step 2: Create Your Config File

Create `.github/hiero-bot.yml` in your repository. Start with the reference config and customize:

```yaml
_extends: hiero-bot

assignment:
  enabled: true
  commands: [/assign, /unassign]
  max_open_assignments: 2
  cross_repo_prerequisites: false
  status_labels:
    ready: "status: ready for dev"
    in_progress: "status: in progress"
    blocked: "status: blocked"
    needs_review: "status: needs review"
  skill_levels:
    "skill: good first issue":
      max_completions: 5
      display_name: Good First Issue
    "skill: beginner":
      prerequisites:
        label: "skill: good first issue"
        min_completed: 2
      display_name: Beginner
    "skill: intermediate":
      prerequisites:
        label: "skill: beginner"
        min_completed: 3
      display_name: Intermediate
    "skill: advanced":
      prerequisites:
        label: "skill: intermediate"
        min_completed: 3
      display_name: Advanced

pr_quality:
  enabled: true
  checks:
    dco: true
    gpg: true
    merge_conflict: true
    linked_issue: true
    conventional_title: false
    linked_issue_assigned: false

inactivity:
  enabled: false    # <-- enable after verifying assignment + PR quality
  warn_after_days: 5
  close_after_days: 7
  blocked_checkin_days: 30
  exempt_labels: ["status: blocked"]
  skip_labels: ["status: needs review"]

audit:
  include_reason_in_comments: true
```

### Step 3: Map Hardcoded Values to Config

Every hardcoded value from the old scripts becomes a config entry. Here's the complete mapping:

| Old Location | Old Value | New Config Key |
|---|---|---|
| `assign-comments.js` | `MAX_OPEN_ASSIGNMENTS = 2` | `assignment.max_open_assignments` |
| `assign-comments.js` | `MAX_GFI_COMPLETIONS = 5` | `assignment.skill_levels["skill: good first issue"].max_completions` |
| `constants.js` | `SKILL_HIERARCHY` (4 levels) | `assignment.skill_levels` (keys define hierarchy order) |
| `constants.js` | `SKILL_PREREQUISITES` (4 entries) | `assignment.skill_levels.<level>.prerequisites` |
| `constants.js` | `LABELS.READY_FOR_DEV` | `assignment.status_labels.ready` |
| `constants.js` | `LABELS.IN_PROGRESS` | `assignment.status_labels.in_progress` |
| `constants.js` | `LABELS.BLOCKED` | `assignment.status_labels.blocked` |
| `constants.js` | `LABELS.NEEDS_REVIEW` | `assignment.status_labels.needs_review` |
| `constants.js` | `LABELS.NEEDS_REVISION` | `assignment.status_labels.needs_revision` |
| `bot-inactivity.js` | `WARN_AFTER_MS = 5 days` | `inactivity.warn_after_days` |
| `bot-inactivity.js` | `CLOSE_AFTER_MS = 7 days` | `inactivity.close_after_days` |
| `bot-inactivity.js` | `BLOCKED_CHECKIN_AFTER_MS = 30 days` | `inactivity.blocked_checkin_days` |
| `comments.js` | `SIGNING_GUIDE` URL | Remove (built into dashboard comment) |
| `comments.js` | `MERGE_CONFLICTS_GUIDE` URL | Remove (built into dashboard comment) |
| `finalize-comments.js` | `SKILL_TITLE_PREFIXES` | (Coming in Phase 3 — `/finalize` not yet ported) |
| `finalize.js` | `ALLOWED_ROLE_NAMES` | (Coming in Phase 3) |
| `finalize.js` | `KNOWN_ISSUE_TYPES` | (Coming in Phase 3) |

### Step 4: Map Workflows to Modules

Each old workflow triggers a corresponding module in the App:

| Old Workflow | Trigger | Module | Status |
|---|---|---|---|
| `on-comment.yaml` | `issue_comment: created` | **Assignment** (handles `/assign`, `/unassign`) | ✅ Live |
| `on-pr.yaml` | `pull_request: opened` | **PR Quality** (dashboard on PR open) | ✅ Live |
| `on-pr-update.yaml` | `pull_request: synchronized, edited` | **PR Quality** (dashboard on PR update) | ✅ Live |
| `on-pr-review.yaml` | `pull_request_review: submitted` | **Assignment** (review state handling) | ✅ Live |
| `on-pr-close.yaml` (job 1) | `pull_request: closed, merged` | **PR Quality** (sibling conflict check) | ⏳ Phase 3 |
| `on-pr-close.yaml` (job 2) | `pull_request: closed, merged` | **Progression** (issue recommendations) | ⏳ Phase 2 |
| `on-schedule-inactivity.yaml` | `schedule` (daily) | **Inactivity** (stale warnings + close) | ⏳ Phase 2 |

### Step 5: Remove Old Workflows

After verifying the App works for a few days, delete the old workflow files **one at a time**:

```bash
# Start with these (fully replaced by App)
git rm .github/workflows/on-comment.yaml
git rm .github/workflows/on-pr.yaml
git rm .github/workflows/on-pr-update.yaml
git rm .github/workflows/on-pr-review.yaml

# Remove after verifying Inactivity module (Phase 2)
# git rm .github/workflows/on-schedule-inactivity.yaml

# Remove after verifying Progression module (Phase 2/3)
# git rm .github/workflows/on-pr-close.yaml
```

Keep these workflows — they're build infrastructure, not bot logic:

```bash
# These stay — they compile C++, not bot logic
.github/workflows/zxc-build-library.yaml
.github/workflows/flow-pull-request-checks.yaml
.github/workflows/on-schedule-builds.yaml
```

### Step 6: Remove Old Scripts

Once all workflows are migrated:

```bash
# Remove everything under .github/scripts/
git rm -r .github/scripts/
```

### Step 7: Enable Remaining Modules

Enable modules as they become available:

```yaml
# Phase 2
inactivity:
  enabled: true

# Phase 3
escalation:
  enabled: true
  rules:
    - label: "priority: high"
      notify_team: "hiero-sdk-cpp-maintainers"
      cooldown_hours: 24
```

---

## Rollback Plan

If you need to revert to the old system:

1. **Disable the App**: Uninstall from the repository at `Settings → GitHub Apps → Configure`
2. **Restore old workflows**: `git revert` the commit that removed them
3. The old Actions will start running on the next trigger event

No data migration needed — the App is stateless (SQLite is used only for cross-repo tracking in Phase 2+).

---

## FAQ

### Do I need to keep both systems running?

For a **1-week transition period**, yes. The App and old workflows can co-exist safely since the App uses different bot comment markers (`<!-- hiero-bot-pr-dashboard -->` vs `<!-- bot:pr-helper -->`).

### What happens to existing bot comments?

The old `<!-- bot:pr-helper -->` comments are left untouched. The App creates new comments with its own marker. Existing PRs will get new dashboard comments from the App — close old PRs to avoid duplication.

### Can I customize skill level names per repo?

Yes. Each repo's `.github/hiero-bot.yml` can define its own `skill_levels` with different `display_name` values and prerequisite requirements.

### Is the JSON Schema published?

Yes. The compiled schema is at `src/config/schema.js`. All config is validated with `additionalProperties: false` so typos and unknown keys are caught immediately.

### Does the App need organization-level access?

For the `_extends: hiero-bot` inheritance chain, create `hiero-ledger/.github/hiero-bot.yml` with org-wide defaults. Repos without this file use built-in safe defaults (all modules off).

---

## Timeline

| Phase | Deliverable | Modules |
|-------|-----------|---------|
| **Phase 1** (current) | Assignment + PR Quality | `/assign`, `/unassign`, dashboard, audit |
| **Phase 2** (next) | Inactivity + Escalation + Onboarding | Cron sweeps, team pings, welcome messages |
| **Phase 3** | Progression + `/finalize` | Issue recommendations, triage finalization |
| **Phase 4** | AI Planning + Review (opt-in stubs) | LLM-generated breakdowns and reviews |

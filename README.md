<p align="center">
  <a href="https://github.com/cheese-cakee/hiero-workflow-app">
    <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" width="60" alt="Hiero Workflow App">
  </a>
</p>
<p align="center"><strong>Hiero Workflow App</strong></p>
<p align="center">A reusable, config-driven GitHub App for automating maintainer workflows<br/>across the Hiero SDK ecosystem.</p>

<p align="center">
  <a href="https://github.com/cheese-cakee/hiero-workflow-app/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/cheese-cakee/hiero-workflow-app/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://github.com/cheese-cakee/hiero-workflow-app/blob/master/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" /></a>
  <img alt="Tests" src="https://img.shields.io/badge/tests-138%20passed-4c1?style=flat-square" />
  <img alt="Coverage" src="https://img.shields.io/badge/coverage-94%25%20lines-4c1?style=flat-square" />
</p>

---

## Why

The Hiero SDK org maintains 7+ repositories. Each has its own set of JavaScript
and Bash scripts for `/assign`, `/unassign`, stale issue tracking, PR quality checks,
and onboarding. These scripts are copy-pasted between repos, wired differently per
Actions workflow, and produce 5+ bot comments per PR with no unified audit trail.

The Hiero Workflow App replaces all of that with a **single GitHub App** and a
**single `.github/hiero-bot.yml` config file** per repository.

---

## How It Works

```
GitHub webhook → Probot Router → Config Engine (Ajv + deep merge) → Module dispatch
                                                                       ↓
                                                                Assignment  ↕  GitHub Issues API
                                                                PR Quality  ↕  GitHub Pulls API
                                                                Inactivity  ↕  GitHub Search API
                                                                       ↓
                                                                Audit Logger
```

1. A GitHub event fires (e.g. `/assign` comment, PR opened).
2. The Probot webhook router receives it and loads repository configuration
   from `.github/hiero-bot.yml`.
3. Configuration is validated against a JSON Schema (Ajv), merged with org-level
   defaults via `_extends`, and dispatched to the relevant module.
4. The module enforces its gates (prerequisites, limits, label checks), then
   performs the action using the GitHub API.
5. Every decision is logged to the audit trail with an optional public comment
   explaining the reasoning to maintainers.

---

## What It Does Right Now

### Assignment

Commend `/assign` or `/unassign` on an issue. The bot enforces:

| Gate | Rule |
|------|------|
| Issue state | Must not already be assigned |
| Status label | Must have the configured "ready" label |
| Skill level | Must match a configured skill tier |
| Prerequisites | Must have completed N issues at lower tier |
| GFI cap | Can only complete X Good First Issues |
| Assignment limit | Cannot exceed Y open assigned issues |

On success: assigns the user, swaps status labels, posts a welcome comment.
On failure: posts a specific, actionable comment explaining why.

### PR Quality Dashboard

Every PR gets a single persistent dashboard comment that updates in-place
(no comment spam). Checks:

| Check | Source |
|-------|--------|
| DCO sign-off | Every commit has `Signed-off-by:` |
| GPG verification | Every commit is GPG signed |
| Merge conflicts | `mergeable` API field |
| Linked issue | PR body references an issue (`fixes #N`) |
| Conventional title | `type(scope): description` format |
| Linked issue assigned | Referenced issue has an assignee |

Draft PRs show an informational dashboard with an explainer note.

---

## Configuration

Drop a file at `.github/hiero-bot.yml` in any installed repository:

```yaml
_extends: hiero-bot

assignment:
  enabled: true
  commands: [/assign, /unassign]
  max_open_assignments: 3
  status_labels:
    ready: "status: ready for dev"
    in_progress: "status: in progress"
  skill_levels:
    "skill: good first issue":
      max_completions: 5
      display_name: Good First Issue
    "skill: beginner":
      prerequisites:
        label: "skill: good first issue"
        min_completed: 2
      display_name: Beginner

pr_quality:
  enabled: true
  checks:
    dco: true
    gpg: true
    merge_conflict: true
    linked_issue: true
    conventional_title: true

audit:
  include_reason_in_comments: true
```

Org-level defaults live at `hiero-ledger/.github/hiero-bot.yml` and are inherited
via the `_extends` mechanism. Per-repo config is deep-merged and validated against
a JSON Schema before any action executes. Invalid config falls back to safe
defaults (all modules disabled).

Full reference: [`examples/hiero-bot.yml`](examples/hiero-bot.yml)

---

## Technology

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | Node.js ≥ 20, CommonJS + JSDoc | Matches existing Hiero SDK bot scripts; zero build step |
| Framework | Probot v13 | GitHub App auth, webhook routing, `context.config()` |
| Validation | Ajv | JSON Schema with strict mode, `additionalProperties: false` |
| Testing | Jest | Same framework as the C++ SDK bot scripts |
| Deployment | Fly.io / Docker | Persistent server for scheduled sweep tasks |

---

## Development

### Quick Start

```bash
npm ci
cp .env.example .env
# Fill in APP_ID, WEBHOOK_SECRET, PRIVATE_KEY_PATH
npm run dev
```

### GitHub App Setup

1. [Create a GitHub App from manifest](https://github.com/settings/apps/new?url=https://raw.githubusercontent.com/cheese-cakee/hiero-workflow-app/master/app.yml)
2. Generate a private key, save as `private-key.pem`
3. Install the App on a test repository
4. Drop `examples/hiero-bot.yml` into `.github/hiero-bot.yml`

### Webhook Proxy

For local development, use [localtunnel](https://github.com/localtunnel/localtunnel):

```bash
# Terminal 1
npm start                    # Probot on :3000

# Terminal 2
npx localtunnel --port 3000  # Public URL → localhost
```

Then update the App's webhook URL to `https://<tunnel>.loca.lt/api/github/webhooks`.

### Commands

```bash
npm start          # Production (probot run)
npm run dev        # Development (nodemon)
npm test           # Jest (138 tests)
npm run coverage   # Jest with coverage report
npm run lint       # ESLint (zero tolerance)
npm run setup      # Interactive setup wizard
```

---

## Modules

| Module | Status | Gates |
|--------|--------|-------|
| Assignment | Alpha | 6-gate `/assign`, 3-gate `/unassign` |
| PR Quality | Alpha | 6 configurable checks, persistent dashboard |
| Inactivity | Planned | Stale assignment warnings + auto-close |
| Onboarding | Planned | First-time contributor detection |
| Escalation | Planned | Label-based team notifications |
| AI Planning | Planned | Stub interface for LLM-generated issue breakdowns |
| AI Review | Planned | Stub interface for LLM-generated PR reviews |

---

## Project Structure

```
.
├── src/
│   ├── index.js                # Probot entry point + health endpoint
│   ├── router.js               # Event dispatch + audit wiring
│   ├── audit.js                # Centralized audit log (log + logAndComment)
│   ├── config/
│   │   ├── schema.js           # Ajv JSON Schema (all 9 modules)
│   │   ├── loader.js           # Probot context.config() + deep merge
│   │   └── defaults.js         # Safe defaults (everything off)
│   ├── helpers/
│   │   ├── github.js           # Octokit API wrappers (23 functions)
│   │   ├── context.js          # Probot payload → botContext mapper
│   │   └── logger.js           # Pino child logger factory
│   └── modules/
│       ├── assignment/         # /assign + /unassign (comments, eligibility)
│       └── pr-quality/         # Checks + persistent dashboard editor
├── tests/
│   ├── helpers/                # github.test.js, context.test.js
│   ├── config/                 # schema.test.js, loader.test.js
│   ├── modules/                # assignment.test.js, pr-quality.test.js, router.test.js
│   └── fixtures/               # 5 Probot-compatible webhook payloads
├── examples/hiero-bot.yml      # Annotated reference config
├── docs/getting-started.md     # Step-by-step setup guide
├── Dockerfile                  # Alpine + least-privilege user + HEALTHCHECK
├── docker-compose.yml          # Secrets-based key injection
├── fly.toml                    # Fly.io deployment config
└── scripts/setup.js            # Interactive setup wizard
```

---

## License

Apache 2.0

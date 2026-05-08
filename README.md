# Hiero Workflow App

A reusable, config-driven GitHub App for automating maintainer workflows across
the Hiero SDK ecosystem.

## Overview

The Hiero Workflow App replaces fragmented per-repository bot scripts with a
unified, configurable automation layer. It is designed for:

- **Reusability** — One GitHub App serves 7+ SDK repositories, each with its own
  configuration overrides.
- **Transparency** — Every automated action is logged with a clear audit trail.
- **Safety** — Minimal permissions, graceful degradation, and maintainer overrides.
- **Extensibility** — Modular architecture that allows new automation features to
  be added without disrupting existing workflows.

## Architecture

```
GitHub Events  →  Webhook Router  →  Config Engine  →  Module Dispatcher
                                                       ↓
                                              ┌────────┴────────┐
                                              │   Assignment    │
                                              │   PR Quality    │
                                              │   Inactivity    │
                                              │   Onboarding    │
                                              │   Escalation    │
                                              └─────────────────┘
                                                       ↓
                                                Audit Logger
```

## Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | JavaScript (CommonJS) + JSDoc | Matches Hiero SDK C++ bot scripts; zero build step |
| Framework | Probot | Industry-standard GitHub App framework with built-in auth and config resolution |
| Validation | Ajv | JSON Schema validation for repository configuration |
| Testing | Jest | Same framework used by the C++ SDK bot scripts |

## Local Development

### Prerequisites

- Node.js >= 20.0.0
- npm
- A GitHub App (for webhooks) or [smee.io](https://smee.io) for local proxying

### Setup

```bash
# Install dependencies
npm install

# Start the app locally with webhook forwarding
npm run dev
```

### Environment Variables

```bash
# Required
APP_ID=123456
PRIVATE_KEY_PATH=./private-key.pem
WEBHOOK_SECRET=your-webhook-secret

# Optional
LOG_LEVEL=info          # debug, info, warn, error
DRY_RUN=true            # Log actions without executing them
```

## Configuration

Each repository can define `.github/hiero-bot.yml` to customize behavior.
Org-level defaults live in `hiero-ledger/.github/hiero-bot.yml` and are
automatically inherited via Probot's `_extends` mechanism.

See [`examples/hiero-bot.yml`](examples/hiero-bot.yml) for a full reference.

## Modules

| Module | Status | Description |
|--------|--------|-------------|
| Assignment | Alpha | `/assign`, `/unassign` with skill-level prerequisites and limits |
| PR Quality | Alpha | Unified dashboard comment for DCO, GPG, linked issue, merge conflicts |
| Inactivity | Planned | Warn and close stale assignments |
| Onboarding | Planned | Welcome first-time contributors |
| Escalation | Planned | Notify teams based on issue labels |
| AI Planning | Planned | AI-generated issue breakdowns (stub) |
| AI Review | Planned | AI-generated PR reviews (stub) |

## License

Apache-2.0

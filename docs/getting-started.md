# Getting Started with Hiero Workflow App

## Prerequisites

- Node.js >= 20
- A GitHub account with permission to install GitHub Apps

## 1. Create a GitHub App

1. Go to your GitHub account **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Fill in:
   - **Name**: Hiero Workflow App (or your preferred name)
   - **Homepage URL**: `https://github.com/cheese-cakee/hiero-workflow-app`
   - **Webhook URL**: Use a [smee.io](https://smee.io) channel URL for local dev, or your production URL
   - **Webhook secret**: Generate a random string
3. **Permissions** (Repository):
   - **Issues**: Read & Write
   - **Pull requests**: Read & Write
   - **Metadata**: Read-only (mandatory)
4. **Subscribe to events**:
   - Issues
   - Issue comment
   - Pull request
   - Pull request review
   - Repository (schedule events)
5. Generate and download a **private key** (`.pem` file).

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
APP_ID=123456
WEBHOOK_SECRET=your_secret_here
PRIVATE_KEY_PATH=./private-key.pem
```

Place your downloaded `.pem` key at the path specified in `PRIVATE_KEY_PATH`.

## 3. Install & Run

```bash
npm ci
npm run dev
```

For local development with smee.io:
```bash
npx smee --url https://smee.io/your-channel --path / --port 3000
```

## 4. Configure the Bot

Create `.github/hiero-bot.yml` in your test repository:

```yaml
_extends: hiero-bot
assignment:
  commands: [/assign, /unassign]
  max_open_assignments: 3
pr_quality:
  checks:
    dco: true
    gpg: true
    merge_conflict: true
    linked_issue: true
    conventional_title: true
```

## 5. Try It Out

- Comment `/assign` on a `status: ready for dev` labeled issue
- Open a pull request to see the quality dashboard
- Check `/health` endpoint at `http://localhost:3000/health`

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

/**
 * Setup script for the Hiero Workflow App.
 *
 * Walks you through creating a GitHub App, configuring .env, and
 * verifying that the app starts correctly.
 *
 * Usage: node scripts/setup.js
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_URL =
  'https://github.com/settings/apps/new?' +
  'url=https://raw.githubusercontent.com/cheese-cakee/hiero-workflow-app/master/app.yml';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function step(n, title) {
  console.log(`\n${CYAN}[${n}/6] ${title}${RESET}`);
}

function info(msg) {
  console.log(`  ${msg}`);
}

function url(msg, link) {
  console.log(`  ${GREEN}${msg}${RESET}`);
  console.log(`  ${YELLOW}${link}${RESET}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log(`${CYAN}=== Hiero Workflow App Setup ===${RESET}\n`);

step(1, 'Check prerequisites');
const hasNode = process.version;
const rootDir = path.resolve(__dirname, '..');
info(`Node.js ${hasNode}`);
info(`App directory: ${rootDir}`);

step(2, 'Create a GitHub App');
console.log(`  Open this URL in your browser:`);
console.log(`  ${YELLOW}${MANIFEST_URL}${RESET}`);
info('GitHub will read the app.yml manifest and auto-configure everything.');
info('After creating the app:');
info('  1. Note the App ID (shown at the top of the settings page)');
info('  2. Generate & download a private key (.pem file)');
info('  3. Generate a webhook secret (any random string)');

step(3, 'Install dependencies');
info('Running npm ci...');
require('child_process').execSync('npm ci', { cwd: rootDir, stdio: 'inherit' });

step(4, 'Configure environment');
const envExample = path.join(rootDir, '.env.example');
const envFile = path.join(rootDir, '.env');

if (!fs.existsSync(envFile)) {
  fs.copyFileSync(envExample, envFile);
  info(`Created ${envFile} (copy of .env.example)`);
}
info(`Edit ${YELLOW}${envFile}${RESET} and fill in:`);
info('  APP_ID=your_app_id');
info('  WEBHOOK_SECRET=your_secret');
info('  PRIVATE_KEY_PATH=./private-key.pem');

step(5, 'Verify health endpoint');
info('Run: npm start');
info('In another terminal: curl http://localhost:3000/health');
info('Expected: {"status":"ok","timestamp":"..."}');

step(6, 'Install on a test repo');
url('Install the app on your test repository:', '');
url(
  'https://github.com/settings/apps/hiero-workflow-app/installations',
  '',
);
info('After installing, create .github/hiero-bot.yml in the test repo:');
info(`  cp ${rootDir}\\examples\\hiero-bot.yml .github\\hiero-bot.yml`);
info('Edit the file to enable the modules you want to test.');

console.log(`\n${GREEN}Setup complete!${RESET}`);
console.log(`Run ${CYAN}npm start${RESET} to launch the app.`);

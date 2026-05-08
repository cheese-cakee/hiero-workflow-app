// SPDX-License-Identifier: Apache-2.0

/**
 * PR Quality Dashboard builder and comment manager.
 *
 * Uses the Renovate/Dependabot pattern: a hidden HTML marker in the comment
 * body identifies the persistent dashboard comment. On every PR update, the
 * App finds the existing comment by searching for the marker and edits it in
 * place, keeping the PR thread clean.
 */

const DASHBOARD_MARKER = '<!-- hiero-bot-pr-dashboard -->';

/**
 * Finds the existing dashboard comment on a PR, if any.
 *
 * @param {object} botContext
 * @returns {Promise<number|null>} The comment ID, or null if not found.
 */
async function findExistingDashboardComment(botContext) {
  try {
    const response = await botContext.github.issues.listComments({
      owner: botContext.owner,
      repo: botContext.repo,
      issue_number: botContext.pullRequest.number,
      per_page: 100,
    });

    for (const comment of response.data) {
      if (comment.body && comment.body.includes(DASHBOARD_MARKER)) {
        return comment.id;
      }
    }

    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * Posts or edits the dashboard comment on a PR.
 *
 * @param {object} botContext
 * @param {string} body
 * @returns {Promise<void>}
 */
async function upsertDashboardComment(botContext, body) {
  const existingId = await findExistingDashboardComment(botContext);

  if (existingId) {
    await botContext.github.issues.updateComment({
      owner: botContext.owner,
      repo: botContext.repo,
      comment_id: existingId,
      body,
    });
  } else {
    await botContext.github.issues.createComment({
      owner: botContext.owner,
      repo: botContext.repo,
      issue_number: botContext.pullRequest.number,
      body,
    });
  }
}

/**
 * Builds the dashboard comment body from check results.
 *
 * @param {object} results - Map of check name to { passed, details? }.
 * @param {boolean} isDraft
 * @returns {string}
 */
function buildDashboardBody(results, isDraft) {
  const lines = [
    DASHBOARD_MARKER,
    '## 🤖 PR Quality Dashboard',
    '',
    '| Check | Status |',
    '|-------|--------|',
  ];

  for (const [name, result] of Object.entries(results)) {
    const status = result.passed ? '✅ Pass' : '❌ Fail';
    const detail = result.details ? ` — ${result.details}` : '';
    lines.push(`| ${name} | ${status}${detail} |`);
  }

  if (isDraft) {
    lines.push(
      '',
      '> **Note**: This PR is a **draft**. The checks above are informational; '
      + 'they will be re-evaluated when the PR is marked ready for review.',
    );
  }

  lines.push(
    '',
    '<sub>Last updated by Hiero Bot. Edit `.github/hiero-bot.yml` to customize.</sub>',
  );

  return lines.join('\n');
}

module.exports = {
  findExistingDashboardComment,
  upsertDashboardComment,
  buildDashboardBody,
  DASHBOARD_MARKER,
};

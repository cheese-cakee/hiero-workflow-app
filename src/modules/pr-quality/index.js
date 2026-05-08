// SPDX-License-Identifier: Apache-2.0

/**
 * PR Quality module.
 *
 * Maintains a single persistent dashboard comment on every PR that
 * summarizes the results of configurable quality checks. The comment is
 * updated in-place on every PR event (open, edit, synchronize) using a
 * hidden HTML marker, keeping the PR thread tidy.
 *
 * Configurable checks:
 * - DCO sign-off on commits
 * - GPG verification on commits
 * - Merge conflicts
 * - Linked issue in description
 * - Conventional commit title
 * - Linked issue has assignee
 */

const {
  checkDco,
  checkGpg,
  checkMergeConflict,
  checkLinkedIssue,
  checkConventionalTitle,
  checkLinkedIssueAssigned,
} = require('./checks');

const { upsertDashboardComment, buildDashboardBody } = require('./dashboard');

/**
 * Runs all enabled checks and returns a results map.
 *
 * @param {object} botContext
 * @param {object} checksConfig
 * @returns {Promise<object>}
 */
async function runChecks(botContext, checksConfig) {
  const results = {};

  if (checksConfig.dco) {
    results['DCO Sign-off'] = await checkDco(botContext);
  }

  if (checksConfig.gpg) {
    results['GPG Verified'] = await checkGpg(botContext);
  }

  if (checksConfig.merge_conflict) {
    results['No Merge Conflicts'] = await checkMergeConflict(botContext);
  }

  if (checksConfig.linked_issue) {
    const linkedResult = await checkLinkedIssue(botContext);
    results['Linked Issue'] = linkedResult;

    if (linkedResult.passed && linkedResult.issueNumber && checksConfig.linked_issue_assigned) {
      results['Linked Issue Assigned'] = await checkLinkedIssueAssigned(
        botContext,
        linkedResult.issueNumber,
      );
    }
  }

  if (checksConfig.conventional_title) {
    results['Conventional Title'] = await checkConventionalTitle(botContext);
  }

  return results;
}

/**
 * Main handler for pull request events.
 *
 * @param {object} botContext
 * @param {object} moduleConfig
 * @param {import('probot').Logger} logger
 * @param {object} audit
 */
async function handlePullRequestEvent(botContext, moduleConfig, logger, audit) {
  const isDraft = botContext.pullRequest.draft === true;

  logger.info('Running PR quality checks');
  const results = await runChecks(botContext, moduleConfig.checks);

  const body = buildDashboardBody(results, isDraft);
  await upsertDashboardComment(botContext, body);

  const passCount = Object.values(results).filter((r) => r.passed).length;
  const totalCount = Object.keys(results).length;

  logger.info({ passCount, totalCount }, 'PR quality dashboard updated');
  audit.log(botContext, 'pr_quality', 'dashboard_updated', {
    passCount,
    totalCount,
    isDraft,
  });
}

module.exports = {
  handlePullRequestOpened: handlePullRequestEvent,
  handlePullRequestEdited: handlePullRequestEvent,
  handlePullRequestSynchronized: handlePullRequestEvent,
};

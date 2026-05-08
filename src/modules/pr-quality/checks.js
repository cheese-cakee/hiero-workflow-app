// SPDX-License-Identifier: Apache-2.0

/**
 * Individual PR quality checks.
 *
 * Each check is an async function that receives the bot context and
 * returns `{ passed: boolean, details?: string }`. The functions are
 * intentionally simple and focused — complexity lives in the dashboard
 * builder that aggregates them.
 */

const LINKED_ISSUE_REGEX = /(?:fixes|closes|resolves|addresses|refs?)\s+#(\d+)|#(\d+)/gi;

/**
 * Checks whether all commits in the PR have a DCO sign-off.
 *
 * @param {object} botContext
 * @returns {Promise<{ passed: boolean, details?: string }>}
 */
async function checkDco(botContext) {
  try {
    const response = await botContext.github.pulls.listCommits({
      owner: botContext.owner,
      repo: botContext.repo,
      pull_number: botContext.pullRequest.number,
      per_page: 100,
    });

    const commits = response.data;
    const unsignedCommits = commits.filter((commit) => {
      const message = commit.commit?.message ?? '';
      return !message.includes('Signed-off-by:');
    });

    if (unsignedCommits.length === 0) {
      return { passed: true };
    }

    return {
      passed: false,
      details: `${unsignedCommits.length} commit(s) missing DCO sign-off`,
    };
  } catch (error) {
    return { passed: false, details: 'Could not verify DCO status' };
  }
}

/**
 * Checks whether all commits in the PR are GPG verified.
 *
 * @param {object} botContext
 * @returns {Promise<{ passed: boolean, details?: string }>}
 */
async function checkGpg(botContext) {
  try {
    const response = await botContext.github.pulls.listCommits({
      owner: botContext.owner,
      repo: botContext.repo,
      pull_number: botContext.pullRequest.number,
      per_page: 100,
    });

    const commits = response.data;
    const unverifiedCommits = commits.filter((commit) => {
      return commit.commit?.verification?.verified !== true;
    });

    if (unverifiedCommits.length === 0) {
      return { passed: true };
    }

    return {
      passed: false,
      details: `${unverifiedCommits.length} commit(s) not GPG verified`,
    };
  } catch (error) {
    return { passed: false, details: 'Could not verify GPG status' };
  }
}

/**
 * Checks whether the PR has merge conflicts.
 *
 * Note: GitHub computes mergeability asynchronously. If the field is null,
 * we conservatively report that the check is pending.
 *
 * @param {object} botContext
 * @returns {Promise<{ passed: boolean, details?: string }>}
 */
async function checkMergeConflict(botContext) {
  const mergeable = botContext.pullRequest.mergeable;

  if (mergeable === true) {
    return { passed: true };
  }

  if (mergeable === false) {
    return { passed: false, details: 'Merge conflicts detected' };
  }

  return { passed: false, details: 'Mergeability pending — check again shortly' };
}

/**
 * Checks whether the PR description links to an issue.
 *
 * @param {object} botContext
 * @returns {Promise<{ passed: boolean, details?: string, issueNumber?: number }>}
 */
async function checkLinkedIssue(botContext) {
  const body = botContext.pullRequest.body ?? '';
  const matches = [...body.matchAll(LINKED_ISSUE_REGEX)];

  if (matches.length === 0) {
    return { passed: false, details: 'No linked issue found in PR description' };
  }

  const issueNumber = parseInt(matches[0][1] ?? matches[0][2], 10);
  return { passed: true, issueNumber };
}

/**
 * Checks whether the PR title follows Conventional Commits format.
 *
 * @param {object} botContext
 * @returns {Promise<{ passed: boolean, details?: string }>}
 */
async function checkConventionalTitle(botContext) {
  const title = botContext.pullRequest.title ?? '';
  // Conventional commit: type(scope)!: description or type: description
  const conventionalRegex = /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\(.+\))?(!)?:\s.+$/;

  if (conventionalRegex.test(title)) {
    return { passed: true };
  }

  return {
    passed: false,
    details: 'PR title does not follow Conventional Commits format',
  };
}

/**
 * Checks whether the linked issue has an assignee.
 *
 * @param {object} botContext
 * @param {number} issueNumber
 * @returns {Promise<{ passed: boolean, details?: string }>}
 */
async function checkLinkedIssueAssigned(botContext, issueNumber) {
  try {
    const response = await botContext.github.issues.get({
      owner: botContext.owner,
      repo: botContext.repo,
      issue_number: issueNumber,
    });

    const issue = response.data;
    if (issue.assignees && issue.assignees.length > 0) {
      return { passed: true };
    }

    return { passed: false, details: `Issue #${issueNumber} has no assignee` };
  } catch (error) {
    return { passed: false, details: `Could not check issue #${issueNumber}` };
  }
}

module.exports = {
  checkDco,
  checkGpg,
  checkMergeConflict,
  checkLinkedIssue,
  checkConventionalTitle,
  checkLinkedIssueAssigned,
};

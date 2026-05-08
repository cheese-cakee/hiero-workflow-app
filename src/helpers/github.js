// SPDX-License-Identifier: Apache-2.0

/**
 * Common GitHub API wrappers used by automation modules.
 *
 * These thin wrappers around Octokit centralize error handling,
 * logging, and response normalization. Every function returns a
 * consistent result object: `{ success: boolean, data?: any, error?: string }`.
 *
 * This prevents modules from needing to catch Octokit errors inline
 * and ensures that API failures are always logged before being
 * surfaced to users.
 */

/**
 * Adds one or more assignees to an issue or pull request.
 *
 * @param {object} botContext
 * @param {string[]} usernames
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function addAssignees(botContext, usernames) {
  try {
    await botContext.github.issues.addAssignees({
      owner: botContext.owner,
      repo: botContext.repo,
      issue_number: botContext.issue.number,
      assignees: usernames,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Removes one or more assignees from an issue or pull request.
 *
 * @param {object} botContext
 * @param {string[]} usernames
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function removeAssignees(botContext, usernames) {
  try {
    await botContext.github.issues.removeAssignees({
      owner: botContext.owner,
      repo: botContext.repo,
      issue_number: botContext.issue.number,
      assignees: usernames,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Posts a comment on an issue or pull request.
 *
 * @param {object} botContext
 * @param {string} body
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function createComment(botContext, body) {
  try {
    await botContext.github.issues.createComment({
      owner: botContext.owner,
      repo: botContext.repo,
      issue_number: botContext.issue.number,
      body,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Adds a reaction to a comment.
 *
 * @param {object} botContext
 * @param {number} commentId
 * @param {string} content - Reaction emoji string (e.g., '+1', 'eyes').
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function addReaction(botContext, commentId, content) {
  try {
    await botContext.github.reactions.createForIssueComment({
      owner: botContext.owner,
      repo: botContext.repo,
      comment_id: commentId,
      content,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Adds a label to an issue or pull request.
 *
 * @param {object} botContext
 * @param {string} label
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function addLabel(botContext, label) {
  try {
    await botContext.github.issues.addLabels({
      owner: botContext.owner,
      repo: botContext.repo,
      issue_number: botContext.issue.number,
      labels: [label],
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Removes a label from an issue or pull request.
 *
 * @param {object} botContext
 * @param {string} label
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function removeLabel(botContext, label) {
  try {
    await botContext.github.issues.removeLabel({
      owner: botContext.owner,
      repo: botContext.repo,
      issue_number: botContext.issue.number,
      name: label,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Atomically swaps one label for another on an issue.
 *
 * @param {object} botContext
 * @param {string} oldLabel
 * @param {string} newLabel
 * @returns {Promise<{ success: boolean, errorDetails?: string }>}
 */
async function swapLabels(botContext, oldLabel, newLabel) {
  const removeResult = await removeLabel(botContext, oldLabel);
  const addResult = await addLabel(botContext, newLabel);

  if (!removeResult.success || !addResult.success) {
    const details = [
      removeResult.success ? null : `remove "${oldLabel}": ${removeResult.error}`,
      addResult.success ? null : `add "${newLabel}": ${addResult.error}`,
    ]
      .filter(Boolean)
      .join('; ');
    return { success: false, error: details };
  }

  return { success: true };
}

/**
 * Checks whether an issue or pull request has a specific label.
 *
 * @param {object} issue - The issue or PR object from the payload.
 * @param {string} labelName
 * @returns {boolean}
 */
function hasLabel(issue, labelName) {
  if (!issue || !Array.isArray(issue.labels)) {
    return false;
  }
  return issue.labels.some((label) => label.name === labelName);
}

/**
 * Counts issues assigned to a user, optionally filtered by state and label.
 *
 * Uses the GitHub Search API, which has a 30 requests/minute rate limit
 * and eventual consistency. For production scale, this should be replaced
 * with a persisted database query (see architecture docs).
 *
 * @param {object} botContext
 * @param {string} username
 * @param {string} state - 'open' or 'closed'.
 * @param {string|null} label
 * @param {number} limit - Short-circuit threshold (stops counting at this number).
 * @returns {Promise<number|null>} Count, or null on API error.
 */
async function countIssuesByAssignee(
  botContext,
  username,
  state,
  label,
  limit,
) {
  try {
    let query = `repo:${botContext.owner}/${botContext.repo} assignee:${username} state:${state}`;
    if (label) {
      query += ` label:"${label}"`;
    }

    const response = await botContext.github.rest.search.issuesAndPullRequests({
      q: query,
      per_page: limit,
    });

    return response.data.items.length;
  } catch (_error) {
    return null;
  }
}

/**
 * Lists open issues assigned to a user in the current repository.
 *
 * @param {object} botContext
 * @param {string} username
 * @returns {Promise<Array|null>} Array of issue objects, or null on error.
 */
async function listAssignedIssues(botContext, username) {
  try {
    const response = await botContext.github.issues.listForRepo({
      owner: botContext.owner,
      repo: botContext.repo,
      assignee: username,
      state: 'open',
      per_page: 100,
    });
    return response.data;
  } catch (_error) {
    return null;
  }
}

module.exports = {
  addAssignees,
  removeAssignees,
  createComment,
  addReaction,
  addLabel,
  removeLabel,
  swapLabels,
  hasLabel,
  countIssuesByAssignee,
  listAssignedIssues,
};

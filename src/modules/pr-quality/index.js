// SPDX-License-Identifier: Apache-2.0

/**
 * PR Quality module stub.
 *
 * Manages the unified PR quality dashboard comment.
 * Full implementation will be added in a subsequent commit.
 */

async function handlePullRequestOpened(botContext, moduleConfig, logger, audit) {
  logger.debug({ moduleConfig }, 'PR Quality module received PR opened event (stub)');
}

async function handlePullRequestEdited(botContext, moduleConfig, logger, audit) {
  logger.debug({ moduleConfig }, 'PR Quality module received PR edited event (stub)');
}

async function handlePullRequestSynchronized(botContext, moduleConfig, logger, audit) {
  logger.debug({ moduleConfig }, 'PR Quality module received PR sync event (stub)');
}

module.exports = {
  handlePullRequestOpened,
  handlePullRequestEdited,
  handlePullRequestSynchronized,
};

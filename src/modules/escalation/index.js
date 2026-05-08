// SPDX-License-Identifier: Apache-2.0

/**
 * Escalation module stub.
 *
 * Notifies teams based on issue labels.
 * Full implementation will be added in a subsequent commit.
 */

async function handleComment(botContext, moduleConfig, logger, audit) {
  logger.debug({ moduleConfig }, 'Escalation module received comment event (stub)');
}

async function handleIssueOpened(botContext, moduleConfig, logger, audit) {
  logger.debug({ moduleConfig }, 'Escalation module received issue opened event (stub)');
}

module.exports = {
  handleComment,
  handleIssueOpened,
};

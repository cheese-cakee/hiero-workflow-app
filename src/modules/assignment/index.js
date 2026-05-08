// SPDX-License-Identifier: Apache-2.0

/**
 * Assignment module stub.
 *
 * Handles /assign, /unassign, and /finalize slash commands.
 * Full implementation will be added in a subsequent commit.
 */

async function handleComment(botContext, moduleConfig, logger, audit) {
  logger.debug({ moduleConfig }, 'Assignment module received comment event (stub)');
}

async function handleReviewSubmitted(botContext, moduleConfig, logger, audit) {
  logger.debug({ moduleConfig }, 'Assignment module received review event (stub)');
}

module.exports = {
  handleComment,
  handleReviewSubmitted,
};

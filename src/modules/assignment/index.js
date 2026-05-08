// SPDX-License-Identifier: Apache-2.0

/**
 * Assignment module entry point.
 *
 * Parses slash commands in issue comments and dispatches to the
 * appropriate handler. Supported commands: /assign, /unassign.
 *
 * The module is config-driven: skill levels, prerequisites, assignment
 * limits, and status labels all come from hiero-bot.yml.
 */

const { handleAssign } = require('./assign');
const { handleUnassign } = require('./unassign');

/**
 * Parses the comment body and extracts the command name.
 *
 * @param {string} body
 * @returns {string|null} 'assign', 'unassign', or null.
 */
function parseCommand(body) {
  if (typeof body !== 'string') {
    return null;
  }
  if (/^\s*\/assign\s*$/i.test(body)) {
    return 'assign';
  }
  if (/^\s*\/unassign\s*$/i.test(body)) {
    return 'unassign';
  }
  return null;
}

/**
 * Handles issue_comment.created events for the assignment module.
 *
 * @param {object} botContext
 * @param {object} moduleConfig
 * @param {import('probot').Logger} logger
 * @param {object} audit
 */
async function handleComment(botContext, moduleConfig, logger, audit) {
  const command = parseCommand(botContext.comment?.body);

  if (!command) {
    return;
  }

  if (!moduleConfig.commands.includes(`/${command}`)) {
    logger.info({ command }, 'Command disabled in config');
    return;
  }

  logger.info({ command }, 'Processing assignment command');

  if (command === 'assign') {
    await handleAssign(botContext, moduleConfig, logger, audit);
  } else if (command === 'unassign') {
    await handleUnassign(botContext, moduleConfig, logger, audit);
  }
}

/**
 * Handles pull_request_review.submitted events.
 * Currently a no-op; may be used in the future to update assignment
 * status when a review is submitted.
 */
async function handleReviewSubmitted(_botContext, _moduleConfig, logger, _audit) {
  logger.debug('Review submitted event received (no-op)');
}

module.exports = {
  handleComment,
  handleReviewSubmitted,
};

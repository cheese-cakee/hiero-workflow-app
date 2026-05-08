// SPDX-License-Identifier: Apache-2.0

/**
 * /unassign command handler.
 *
 * Allows a currently assigned contributor to unassign themselves.
 * Enforces authorization (only assignees can unassign themselves) and
 * reverts status labels back to the community pool.
 */

const {
  removeAssignees,
  swapLabels,
  addReaction,
  createComment,
} = require('../../helpers/github');

const {
  buildSuccessfulUnassignComment,
  buildNotAssignedToUserComment,
  buildNoAssigneeComment,
  buildIssueClosedComment,
  buildUnassignFailureComment,
} = require('./comments');

/**
 * Main entry point for the /unassign command.
 *
 * @param {object} botContext
 * @param {object} moduleConfig
 * @param {import('probot').Logger} logger
 * @param {object} audit
 */
async function handleUnassign(botContext, moduleConfig, logger, audit) {
  const requesterUsername = botContext.comment.user.login;
  const issue = botContext.issue;

  // Acknowledge the command.
  await addReaction(botContext, botContext.comment.id, '+1');

  // ─── GATE 1: Issue must be open ────────────────────────────────────────────
  if (issue.state === 'closed') {
    logger.info('Issue is closed');
    await createComment(botContext, buildIssueClosedComment(requesterUsername));
    audit.log(botContext, 'assignment', 'reject_unassign_closed', {});
    return;
  }

  const assignees = issue.assignees || [];

  // ─── GATE 2: Issue must have assignees ─────────────────────────────────────
  if (assignees.length === 0) {
    logger.info('Issue has no assignees');
    await createComment(botContext, buildNoAssigneeComment(requesterUsername));
    audit.log(botContext, 'assignment', 'reject_unassign_no_assignee', {});
    return;
  }

  // ─── GATE 3: Requester must be the current assignee ────────────────────────
  const isAssigned = assignees.some(
    (a) => (a?.login || '').toLowerCase() === requesterUsername.toLowerCase(),
  );

  if (!isAssigned) {
    logger.info(`@${requesterUsername} is not assigned to this issue`);
    const currentAssignee = assignees[0]?.login ?? 'someone else';
    await createComment(
      botContext,
      buildNotAssignedToUserComment(requesterUsername, currentAssignee),
    );
    audit.log(botContext, 'assignment', 'reject_unassign_unauthorized',
      { currentAssignee });
    return;
  }

  // ─── ACTION: Remove the assignee ───────────────────────────────────────────
  logger.info(`Unassigning @${requesterUsername}`);
  const removeResult = await removeAssignees(botContext, [requesterUsername]);

  if (!removeResult.success) {
    logger.error({ error: removeResult.error }, 'Unassign API call failed');
    await createComment(
      botContext,
      buildUnassignFailureComment(requesterUsername),
    );
    audit.log(botContext, 'assignment', 'unassign_api_error',
      { error: removeResult.error });
    return;
  }

  // ─── ACTION: Swap status labels ────────────────────────────────────────────
  const inProgressLabel = moduleConfig.status_labels?.in_progress;
  const readyLabel = moduleConfig.status_labels?.ready;

  if (inProgressLabel && readyLabel) {
    logger.info(`Swapping labels: ${inProgressLabel} -> ${readyLabel}`);
    const swapResult = await swapLabels(botContext, inProgressLabel, readyLabel);

    if (!swapResult.success) {
      logger.error({ error: swapResult.errorDetails }, 'Label swap failed');
    }
  }

  // ─── ACTION: Post success comment ──────────────────────────────────────────
  await createComment(
    botContext,
    buildSuccessfulUnassignComment(requesterUsername),
  );

  audit.logAndComment(botContext, 'assignment', 'unassigned',
    `Successfully unassigned @${requesterUsername}.`, {});
}

module.exports = {
  handleUnassign,
};

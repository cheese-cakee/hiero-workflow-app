// SPDX-License-Identifier: Apache-2.0

/**
 * /assign command handler.
 *
 * Assigns the commenter to the issue after enforcing a series of gates:
 * issue state, skill-level prerequisites, GFI completion caps, and open
 * assignment limits. On success, swaps status labels and posts a welcome
 * comment. On failure, posts an informative comment explaining why.
 */

const {
  addAssignees,
  swapLabels,
  addReaction,
  createComment,
} = require('../../helpers/github');

const {
  getIssueSkillLevel,
  checkPrerequisites,
  checkGfiCompletionLimit,
  checkAssignmentLimit,
} = require('./eligibility');

const {
  buildWelcomeComment,
  buildAlreadyAssignedComment,
  buildNotReadyComment,
  buildNoSkillLevelComment,
  buildPrerequisiteNotMetComment,
  buildGfiLimitExceededComment,
  buildAssignmentLimitExceededComment,
  buildApiErrorComment,
  buildLabelUpdateFailureComment,
  buildAssignmentFailureComment,
} = require('./comments');

/**
 * Main entry point for the /assign command.
 *
 * @param {object} botContext
 * @param {object} moduleConfig
 * @param {import('probot').Logger} logger
 * @param {object} audit
 */
async function handleAssign(botContext, moduleConfig, logger, audit) {
  const requesterUsername = botContext.comment.user.login;
  const issue = botContext.issue;

  // Acknowledge the command immediately so the user knows it was received.
  await addReaction(botContext, botContext.comment.id, '+1');

  // ─── GATE 1: Issue must not already be assigned ────────────────────────────
  if (issue.assignees?.length > 0) {
    logger.info('Issue already assigned');
    await createComment(
      botContext,
      buildAlreadyAssignedComment(requesterUsername, issue.assignees),
    );
    audit.logAndComment(botContext, 'assignment', 'reject_already_assigned',
      'Issue is already assigned to another contributor.', {});
    return;
  }

  // ─── GATE 2: Issue must have the "ready" status label ──────────────────────
  const readyLabel = moduleConfig.status_labels?.ready;
  if (!readyLabel) {
    logger.warn('No ready label configured');
    return;
  }

  const issueHasReadyLabel = issue.labels?.some((l) => l.name === readyLabel);
  if (!issueHasReadyLabel) {
    logger.info('Issue missing ready label');
    await createComment(
      botContext,
      buildNotReadyComment(requesterUsername, readyLabel),
    );
    audit.logAndComment(botContext, 'assignment', 'reject_not_ready',
      'Issue does not have the required ready label.', {});
    return;
  }

  // ─── GATE 3: Issue must have a recognized skill level ──────────────────────
  const skillLevel = getIssueSkillLevel(issue, moduleConfig.skill_levels);
  if (!skillLevel) {
    logger.info('Issue has no skill level label');
    await createComment(
      botContext,
      buildNoSkillLevelComment(requesterUsername),
    );
    audit.logAndComment(botContext, 'assignment', 'reject_no_skill_level',
      'Issue lacks a recognized skill level label.', {});
    return;
  }

  const skillConfig = moduleConfig.skill_levels[skillLevel];
  const skillDisplayName = skillConfig?.display_name ?? skillLevel;

  logger.info({ skillLevel }, 'Issue skill level identified');

  // ─── GATE 4: Prerequisites must be met ─────────────────────────────────────
  const prereqResult = await checkPrerequisites(
    botContext, moduleConfig, skillLevel, requesterUsername,
  );

  if (!prereqResult.eligible) {
    logger.info({
      required: prereqResult.requiredCount,
      completed: prereqResult.completedCount,
    }, 'Prerequisites not met');

    await createComment(
      botContext,
      buildPrerequisiteNotMetComment(
        requesterUsername,
        skillLevel,
        prereqResult.completedCount,
        prereqResult.requiredCount,
        prereqResult.prerequisiteLabel,
        prereqResult.prerequisiteLabel,
      ),
    );

    audit.logAndComment(botContext, 'assignment', 'reject_prerequisites',
      `Contributor has completed ${prereqResult.completedCount} of ${prereqResult.requiredCount} required prerequisite issues.`,
      { skillLevel, ...prereqResult });
    return;
  }

  // ─── GATE 5: GFI completion cap (if applicable) ────────────────────────────
  const gfiResult = await checkGfiCompletionLimit(
    botContext, moduleConfig, skillLevel, requesterUsername,
  );

  if (!gfiResult.underCap) {
    logger.info({
      completed: gfiResult.completedCount,
      max: skillConfig?.max_completions,
    }, 'GFI completion limit reached');

    await createComment(
      botContext,
      buildGfiLimitExceededComment(
        requesterUsername,
        skillConfig?.max_completions ?? 0,
      ),
    );

    audit.logAndComment(botContext, 'assignment', 'reject_gfi_limit',
      'Contributor has reached the Good First Issue completion cap.', {
        completedCount: gfiResult.completedCount,
      });
    return;
  }

  // ─── GATE 6: Open assignment limit ─────────────────────────────────────────
  const limitResult = await checkAssignmentLimit(
    botContext, moduleConfig, requesterUsername,
  );

  if (!limitResult.withinLimit) {
    logger.info({
      openCount: limitResult.openCount,
      max: moduleConfig.max_open_assignments,
    }, 'Assignment limit exceeded');

    await createComment(
      botContext,
      buildAssignmentLimitExceededComment(
        requesterUsername,
        moduleConfig.max_open_assignments,
        limitResult.openCount,
        limitResult.blockedCount,
      ),
    );

    audit.logAndComment(botContext, 'assignment', 'reject_assignment_limit',
      `Contributor has ${limitResult.openCount} open issues (limit: ${moduleConfig.max_open_assignments}).`,
      { openCount: limitResult.openCount });
    return;
  }

  // ─── ACTION: Assign the user ───────────────────────────────────────────────
  logger.info(`Assigning @${requesterUsername}`);
  const assignResult = await addAssignees(botContext, [requesterUsername]);

  if (!assignResult.success) {
    logger.error({ error: assignResult.error }, 'Assignment API call failed');
    await createComment(
      botContext,
      buildAssignmentFailureComment(requesterUsername),
    );
    audit.log(botContext, 'assignment', 'assign_api_error',
      { error: assignResult.error });
    return;
  }

  // ─── ACTION: Swap status labels ────────────────────────────────────────────
  const inProgressLabel = moduleConfig.status_labels?.in_progress;
  const swapResult = await swapLabels(botContext, readyLabel, inProgressLabel);

  if (!swapResult.success) {
    logger.error({ error: swapResult.errorDetails }, 'Label swap failed');
    await createComment(
      botContext,
      buildLabelUpdateFailureComment(requesterUsername, swapResult.errorDetails),
    );
  }

  // ─── ACTION: Post welcome comment ──────────────────────────────────────────
  await createComment(
    botContext,
    buildWelcomeComment(requesterUsername, skillDisplayName),
  );

  audit.logAndComment(botContext, 'assignment', 'assigned',
    `Successfully assigned @${requesterUsername} to this ${skillDisplayName} issue.`,
    { skillLevel });
}

module.exports = {
  handleAssign,
};

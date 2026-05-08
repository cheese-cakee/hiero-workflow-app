// SPDX-License-Identifier: Apache-2.0

/**
 * Comment builders for the Assignment module.
 *
 * Pure formatting functions separated from assignment logic for readability.
 * All functions accept the module configuration so that labels and limits
 * can be customized per repository.
 */

/**
 * Builds the welcome comment posted after a successful assignment.
 *
 * @param {string} username
 * @param {string} skillLevelDisplayName
 * @returns {string}
 */
function buildWelcomeComment(username, skillLevelDisplayName) {
  return [
    `👋 Hi @${username}, welcome to the project! You've been assigned this **${skillLevelDisplayName}** issue. 🎉`,
    '',
    'If you have any questions, feel free to ask here.',
    '',
    'If you realize you cannot complete this issue, simply comment `/unassign` to return it to the pool.',
    '',
    'Good luck! 🚀',
  ].join('\n');
}

/**
 * Builds the comment when an issue is already assigned.
 *
 * @param {string} requesterUsername
 * @param {Array<{login: string}>} assignees
 * @returns {string}
 */
function buildAlreadyAssignedComment(requesterUsername, assignees) {
  const isAssignedToSelf = assignees.some(
    (a) => (a?.login || '').toLowerCase() === requesterUsername.toLowerCase(),
  );

  if (isAssignedToSelf) {
    return [
      `👋 Hi @${requesterUsername}! You're already assigned to this issue.`,
      '',
      'You are all set to start working on it!',
    ].join('\n');
  }

  const currentAssignee = assignees[0]?.login ?? 'someone else';
  return [
    `👋 Hi @${requesterUsername}! This issue is already assigned to @${currentAssignee}.`,
    '',
    'Please find another issue labeled `status: ready for dev` to work on.',
  ].join('\n');
}

/**
 * Builds the comment when an issue is not ready for assignment.
 *
 * @param {string} requesterUsername
 * @param {string} readyLabel
 * @returns {string}
 */
function buildNotReadyComment(requesterUsername, readyLabel) {
  return [
    `👋 Hi @${requesterUsername}! This issue is not ready for assignment.`,
    '',
    `Issues must have the \`${readyLabel}\` label before they can be assigned.`,
    '',
    'Please wait for a maintainer to triage this issue.',
  ].join('\n');
}

/**
 * Builds the comment when an issue has no skill level label.
 *
 * @param {string} requesterUsername
 * @returns {string}
 */
function buildNoSkillLevelComment(requesterUsername) {
  return [
    `👋 Hi @${requesterUsername}! This issue does not have a recognized skill level label.`,
    '',
    'A maintainer needs to add a skill level label before this issue can be assigned.',
  ].join('\n');
}

/**
 * Builds the comment when prerequisites are not met.
 *
 * @param {string} requesterUsername
 * @param {string} skillLevel
 * @param {number} completedCount
 * @param {number} requiredCount
 * @param {string} prerequisiteLabel
 * @param {string} prerequisiteDisplayName
 * @returns {string}
 */
function buildPrerequisiteNotMetComment(
  requesterUsername,
  skillLevel,
  completedCount,
  requiredCount,
  prerequisiteLabel,
  prerequisiteDisplayName,
) {
  return [
    `👋 Hi @${requesterUsername}! You need more experience before tackling **${skillLevel}** issues.`,
    '',
    `- **Required**: ${requiredCount} completed ${prerequisiteDisplayName}`,
    `- **Your count**: ${completedCount} completed ${prerequisiteDisplayName}`,
    '',
    `Please complete more issues labeled \`${prerequisiteLabel}\` first.`,
  ].join('\n');
}

/**
 * Builds the comment when the GFI completion cap is reached.
 *
 * @param {string} requesterUsername
 * @param {number} maxCompletions
 * @returns {string}
 */
function buildGfiLimitExceededComment(requesterUsername, maxCompletions) {
  return [
    `👋 Hi @${requesterUsername}! You've reached the limit of **${maxCompletions}** Good First Issues.`,
    '',
    'Please move on to Beginner-level issues to continue growing your contributions.',
  ].join('\n');
}

/**
 * Builds the comment when the assignment limit is exceeded.
 *
 * @param {string} requesterUsername
 * @param {number} maxAssignments
 * @param {number} currentCount
 * @param {number} blockedCount
 * @returns {string}
 */
function buildAssignmentLimitExceededComment(
  requesterUsername,
  maxAssignments,
  currentCount,
  blockedCount,
) {
  const lines = [
    `👋 Hi @${requesterUsername}! You have reached the assignment limit.`,
    '',
    `- **Limit**: ${maxAssignments} open issues`,
    `- **Your open issues**: ${currentCount}`,
  ];

  if (blockedCount > 0) {
    lines.push(`- **Blocked issues** (do not count toward limit): ${blockedCount}`);
  }

  lines.push(
    '',
    'Please complete or unassign one of your current issues before requesting another.',
  );

  return lines.join('\n');
}

/**
 * Builds the comment when an API error prevents verification.
 *
 * @param {string} requesterUsername
 * @returns {string}
 */
function buildApiErrorComment(requesterUsername) {
  return [
    `👋 Hi @${requesterUsername}! We encountered an error while processing your request.`,
    '',
    'A maintainer has been notified and will investigate shortly.',
  ].join('\n');
}

/**
 * Builds the comment when label swapping fails after assignment.
 *
 * @param {string} requesterUsername
 * @param {string} errorDetails
 * @returns {string}
 */
function buildLabelUpdateFailureComment(requesterUsername, errorDetails) {
  return [
    `👋 Hi @${requesterUsername}! You were assigned successfully, but we could not update the status labels.`,
    '',
    `Error: ${errorDetails}`,
    '',
    'A maintainer will fix the labels manually.',
  ].join('\n');
}

/**
 * Builds the comment when assignment itself fails.
 *
 * @param {string} requesterUsername
 * @returns {string}
 */
function buildAssignmentFailureComment(requesterUsername) {
  return [
    `👋 Hi @${requesterUsername}! We could not assign you to this issue due to a system error.`,
    '',
    'Please try again later or ask a maintainer for help.',
  ].join('\n');
}

// ─── Unassign Comments ───────────────────────────────────────────────────────

/**
 * Builds the success comment after unassignment.
 *
 * @param {string} requesterUsername
 * @returns {string}
 */
function buildSuccessfulUnassignComment(requesterUsername) {
  return [
    `👋 Hi @${requesterUsername}! You have been unassigned from this issue.`,
    '',
    'The issue has been returned to the community pool. Thank you for your time!',
  ].join('\n');
}

/**
 * Builds the comment when the requester is not assigned.
 *
 * @param {string} requesterUsername
 * @param {string} currentAssignee
 * @returns {string}
 */
function buildNotAssignedToUserComment(requesterUsername, currentAssignee) {
  return [
    `👋 Hi @${requesterUsername}! You are not assigned to this issue.`,
    '',
    `It is currently assigned to @${currentAssignee}. Only the assignee can unassign themselves.`,
  ].join('\n');
}

/**
 * Builds the comment when the issue has no assignees.
 *
 * @param {string} requesterUsername
 * @returns {string}
 */
function buildNoAssigneeComment(requesterUsername) {
  return [
    `👋 Hi @${requesterUsername}! This issue has no assignees.`,
    '',
    'There is nothing to unassign.',
  ].join('\n');
}

/**
 * Builds the comment when the issue is already closed.
 *
 * @param {string} requesterUsername
 * @returns {string}
 */
function buildIssueClosedComment(requesterUsername) {
  return [
    `👋 Hi @${requesterUsername}! This issue is already closed.`,
    '',
    'No action is needed.',
  ].join('\n');
}

/**
 * Builds the comment when unassignment fails.
 *
 * @param {string} requesterUsername
 * @returns {string}
 */
function buildUnassignFailureComment(requesterUsername) {
  return [
    `👋 Hi @${requesterUsername}! We could not unassign you due to a system error.`,
    '',
    'Please try again later or ask a maintainer for help.',
  ].join('\n');
}

module.exports = {
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
  buildSuccessfulUnassignComment,
  buildNotAssignedToUserComment,
  buildNoAssigneeComment,
  buildIssueClosedComment,
  buildUnassignFailureComment,
};

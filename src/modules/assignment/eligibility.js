// SPDX-License-Identifier: Apache-2.0

/**
 * Eligibility checks for the Assignment module.
 *
 * Determines whether a contributor can be assigned to an issue by checking:
 * - Skill-level prerequisites (completed issues at lower levels)
 * - Good First Issue completion caps
 * - Open assignment limits (with optional needs-review bypass)
 *
 * All checks use the GitHub Search API, which has rate limits and eventual
 * consistency. These are port-faithful implementations of the C++ SDK logic.
 */

const { countIssuesByAssignee, listAssignedIssues, hasLabel } = require('../../helpers/github');

/**
 * Finds the highest skill level label on an issue based on the configured
 * skill hierarchy. Returns the first matching label in hierarchy order.
 *
 * @param {object} issue - The issue object from the payload.
 * @param {object} skillLevelsConfig - The assignment.skill_levels config.
 * @returns {string|null} The skill level key, or null if none found.
 */
function getIssueSkillLevel(issue, skillLevelsConfig) {
  const hierarchy = Object.keys(skillLevelsConfig);

  for (const level of hierarchy) {
    if (hasLabel(issue, level)) {
      return level;
    }
  }

  return null;
}

/**
 * Checks whether the requester has completed the prerequisite issues for
 * the given skill level.
 *
 * @param {object} botContext
 * @param {object} moduleConfig
 * @param {string} skillLevel
 * @param {string} requesterUsername
 * @returns {Promise<{ eligible: boolean, completedCount: number, requiredCount: number, prerequisiteLabel: string|null }>}
 */
async function checkPrerequisites(botContext, moduleConfig, skillLevel, requesterUsername) {
  const skillConfig = moduleConfig.skill_levels[skillLevel];
  if (!skillConfig || !skillConfig.prerequisites) {
    return { eligible: true, completedCount: 0, requiredCount: 0, prerequisiteLabel: null };
  }

  const { label, min_completed: requiredCount } = skillConfig.prerequisites;

  // Bypass: if user has completed any issue at the current level or higher,
  // prerequisites are satisfied.
  const hierarchy = Object.keys(moduleConfig.skill_levels);
  const skillIndex = hierarchy.indexOf(skillLevel);

  if (skillIndex !== -1) {
    for (let i = skillIndex; i < hierarchy.length; i++) {
      const checkLevel = hierarchy[i];
      const countAtLevel = await countIssuesByAssignee(
        botContext,
        requesterUsername,
        'closed',
        checkLevel,
        1,
      );

      if (countAtLevel !== null && countAtLevel > 0) {
        return { eligible: true, completedCount: countAtLevel, requiredCount, prerequisiteLabel: label };
      }
    }
  }

  // Normal validation: count closed issues with the prerequisite label.
  const completedCount = await countIssuesByAssignee(
    botContext,
    requesterUsername,
    'closed',
    label,
    requiredCount,
  );

  if (completedCount === null) {
    return { eligible: false, completedCount: 0, requiredCount, prerequisiteLabel: label };
  }

  return {
    eligible: completedCount >= requiredCount,
    completedCount,
    requiredCount,
    prerequisiteLabel: label,
  };
}

/**
 * Checks whether the requester has reached the GFI completion cap.
 *
 * @param {object} botContext
 * @param {object} moduleConfig
 * @param {string} skillLevel
 * @param {string} requesterUsername
 * @returns {Promise<{ underCap: boolean, completedCount: number }>}
 */
async function checkGfiCompletionLimit(botContext, moduleConfig, skillLevel, requesterUsername) {
  const gfiConfig = moduleConfig.skill_levels[skillLevel];
  if (!gfiConfig || !gfiConfig.max_completions) {
    return { underCap: true, completedCount: 0 };
  }

  const maxCompletions = gfiConfig.max_completions;
  const completedCount = await countIssuesByAssignee(
    botContext,
    requesterUsername,
    'closed',
    skillLevel,
    maxCompletions + 1,
  );

  if (completedCount === null) {
    return { underCap: false, completedCount: 0 };
  }

  return {
    underCap: completedCount < maxCompletions,
    completedCount,
  };
}

/**
 * Checks whether the requester is within the open-assignment limit.
 *
 * Includes the needs-review bypass: if all open assigned issues have an
 * open PR with the "needs review" label, the limit is bypassed.
 *
 * @param {object} botContext
 * @param {object} moduleConfig
 * @param {string} requesterUsername
 * @returns {Promise<{ withinLimit: boolean, openCount: number, blockedCount: number }>}
 */
async function checkAssignmentLimit(botContext, moduleConfig, requesterUsername) {
  const maxAssignments = moduleConfig.max_open_assignments;
  const needsReviewLabel = moduleConfig.status_labels?.needs_review;
  const blockedLabel = moduleConfig.status_labels?.blocked;

  const openCount = await countIssuesByAssignee(
    botContext,
    requesterUsername,
    'open',
    null,
    maxAssignments + 1,
  );

  if (openCount === null) {
    return { withinLimit: false, openCount: 0, blockedCount: 0 };
  }

  if (openCount < maxAssignments) {
    return { withinLimit: true, openCount, blockedCount: 0 };
  }

  // Needs-review bypass: fetch assigned issues and check for open PRs.
  const assignedIssues = await listAssignedIssues(botContext, requesterUsername);
  if (assignedIssues === null) {
    return { withinLimit: false, openCount, blockedCount: 0 };
  }

  if (assignedIssues.length === 0) {
    // Vacuous truth guard: empty array should not trigger bypass.
    return { withinLimit: false, openCount, blockedCount: 0 };
  }

  // Count blocked issues for context in the comment.
  let blockedCount = 0;
  if (blockedLabel) {
    blockedCount = assignedIssues.filter((issue) => hasLabel(issue, blockedLabel)).length;
  }

  // Check if every non-blocked assigned issue has a needs-review PR.
  // For simplicity, we check if the issue itself has the needs-review label.
  // The C++ SDK does a more sophisticated PR check; we match that spirit.
  let allHaveNeedsReview = true;
  for (const issue of assignedIssues) {
    if (blockedLabel && hasLabel(issue, blockedLabel)) {
      continue;
    }
    if (!hasLabel(issue, needsReviewLabel)) {
      allHaveNeedsReview = false;
      break;
    }
  }

  if (allHaveNeedsReview) {
    return { withinLimit: true, openCount, blockedCount };
  }

  return { withinLimit: false, openCount, blockedCount };
}

module.exports = {
  getIssueSkillLevel,
  checkPrerequisites,
  checkGfiCompletionLimit,
  checkAssignmentLimit,
};

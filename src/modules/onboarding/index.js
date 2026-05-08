// SPDX-License-Identifier: Apache-2.0

/**
 * Onboarding module stub.
 *
 * Welcomes first-time contributors and checks profile heuristics.
 * Full implementation will be added in a subsequent commit.
 */

async function handleIssueOpened(_botContext, moduleConfig, logger, _audit) {
  logger.debug({ moduleConfig }, 'Onboarding module received issue opened event (stub)');
}

async function handlePullRequestOpened(_botContext, moduleConfig, logger, _audit) {
  logger.debug({ moduleConfig }, 'Onboarding module received PR opened event (stub)');
}

module.exports = {
  handleIssueOpened,
  handlePullRequestOpened,
};

// SPDX-License-Identifier: Apache-2.0

/**
 * Probot application entry point.
 *
 * Registers the webhook router and initializes the Hiero Workflow App.
 * Each event type is dispatched to the router, which loads configuration
 * and forwards to enabled modules.
 *
 * @param {import('probot').Probot} application - The Probot application instance.
 */

const { createRouter } = require('./router');

/**
 * Builds the Probot application by wiring event handlers to the router.
 *
 * @param {import('probot').Probot} application
 */
function buildApplication(application) {
  const router = createRouter(application);

  // Issue and comment events drive assignment, escalation, and slash commands.
  application.on('issues.opened', router.handleIssueOpened);
  application.on('issue_comment.created', router.handleIssueCommentCreated);

  // Pull request events drive the quality dashboard and onboarding.
  application.on('pull_request.opened', router.handlePullRequestOpened);
  application.on('pull_request.edited', router.handlePullRequestEdited);
  application.on('pull_request.synchronize', router.handlePullRequestSynchronized);

  // Review events can update assignment status and quality checks.
  application.on('pull_request_review.submitted', router.handlePullRequestReviewSubmitted);

  // Scheduled events drive inactivity sweeps.
  application.on('schedule.repository', router.handleScheduleRepository);
}

module.exports = buildApplication;
module.exports.buildApplication = buildApplication;

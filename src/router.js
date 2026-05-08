// SPDX-License-Identifier: Apache-2.0

/**
 * Event router for the Hiero Workflow App.
 *
 * The router is the central dispatch point for all GitHub webhooks.
 * Each event handler:
 * 1. Creates a structured logger for the event.
 * 2. Loads and validates repository configuration.
 * 3. Builds a bot context (common accessors for modules).
 * 4. Dispatches to enabled modules.
 * 5. Records the event in the audit log.
 *
 * The router is intentionally thin. Complex logic lives in modules.
 */

const { createLogger } = require('./helpers/logger');
const { buildBotContext } = require('./helpers/context');
const { loadConfig } = require('./config/loader');
const { createAuditLogger } = require('./audit');

// Module stubs — replaced with real implementations in subsequent commits.
const assignmentModule = require('./modules/assignment');
const prQualityModule = require('./modules/pr-quality');
const inactivityModule = require('./modules/inactivity');
const onboardingModule = require('./modules/onboarding');
const escalationModule = require('./modules/escalation');

/**
 * Creates the event router bound to a Probot application.
 *
 * @param {import('probot').Probot} application
 * @returns {object} An object with handler methods for each subscribed event.
 */
function createRouter(application) {
  const audit = createAuditLogger(application);

  /**
   * Shared handler wrapper: loads config, builds context, and audits.
   *
   * @param {string} eventName - The GitHub event name.
   * @param {import('probot').Context} context - The Probot context.
   * @param {Function[]} dispatchers - Array of async functions to call.
   */
  async function handleEvent(eventName, context, dispatchers) {
    const logger = createLogger(application, 'router', context);

    try {
      const config = await loadConfig(context, logger);
      const botContext = buildBotContext(context, config);

      for (const dispatch of dispatchers) {
        await dispatch(botContext, config, logger, audit);
      }

      audit.log(botContext, 'router', 'handled', {
        event: eventName,
        modules_dispatched: dispatchers.length,
      });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack },
        `Unhandled error in ${eventName}`);
    }
  }

  return {
    /**
     * issue_comment.created — slash commands and general comments.
     */
    async handleIssueCommentCreated(context) {
      await handleEvent('issue_comment.created', context, [
        async (botContext, config, logger, audit) => {
          if (config.assignment.enabled) {
            await assignmentModule.handleComment(botContext, config.assignment, logger, audit);
          }
        },
        async (botContext, config, logger, audit) => {
          if (config.escalation.enabled) {
            await escalationModule.handleComment(botContext, config.escalation, logger, audit);
          }
        },
      ]);
    },

    /**
     * issues.opened — new issue triage and labeling.
     */
    async handleIssueOpened(context) {
      await handleEvent('issues.opened', context, [
        async (botContext, config, logger, audit) => {
          if (config.escalation.enabled) {
            await escalationModule.handleIssueOpened(botContext, config.escalation, logger, audit);
          }
        },
        async (botContext, config, logger, audit) => {
          if (config.onboarding.enabled) {
            await onboardingModule.handleIssueOpened(botContext, config.onboarding, logger, audit);
          }
        },
      ]);
    },

    /**
     * pull_request.opened — PR quality checks and contributor onboarding.
     */
    async handlePullRequestOpened(context) {
      await handleEvent('pull_request.opened', context, [
        async (botContext, config, logger, audit) => {
          if (config.pr_quality.enabled) {
            await prQualityModule.handlePullRequestOpened(
              botContext, config.pr_quality, logger, audit);
          }
        },
        async (botContext, config, logger, audit) => {
          if (config.onboarding.enabled) {
            await onboardingModule.handlePullRequestOpened(
              botContext, config.onboarding, logger, audit);
          }
        },
      ]);
    },

    /**
     * pull_request.edited — title/body changes that affect quality checks.
     */
    async handlePullRequestEdited(context) {
      await handleEvent('pull_request.edited', context, [
        async (botContext, config, logger, audit) => {
          if (config.pr_quality.enabled) {
            await prQualityModule.handlePullRequestEdited(
              botContext, config.pr_quality, logger, audit);
          }
        },
      ]);
    },

    /**
     * pull_request.synchronize — new commits pushed.
     */
    async handlePullRequestSynchronized(context) {
      await handleEvent('pull_request.synchronize', context, [
        async (botContext, config, logger, audit) => {
          if (config.pr_quality.enabled) {
            await prQualityModule.handlePullRequestSynchronized(
              botContext, config.pr_quality, logger, audit);
          }
        },
      ]);
    },

    /**
     * pull_request_review.submitted — review state changes.
     */
    async handlePullRequestReviewSubmitted(context) {
      await handleEvent('pull_request_review.submitted', context, [
        async (botContext, config, logger, audit) => {
          if (config.assignment.enabled) {
            await assignmentModule.handleReviewSubmitted(
              botContext, config.assignment, logger, audit);
          }
        },
      ]);
    },

    /**
     * schedule.repository — daily cron for inactivity sweeps.
     */
    async handleScheduleRepository(context) {
      await handleEvent('schedule.repository', context, [
        async (botContext, config, logger, audit) => {
          if (config.inactivity.enabled) {
            await inactivityModule.handleSchedule(
              botContext, config.inactivity, logger, audit);
          }
        },
      ]);
    },
  };
}

module.exports = {
  createRouter,
};

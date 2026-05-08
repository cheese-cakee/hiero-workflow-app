// SPDX-License-Identifier: Apache-2.0

/**
 * Centralized audit logger.
 *
 * Every automated decision is recorded here with a structured payload
 * containing the trigger, the configuration that was active, and the
 * outcome. When `audit.include_reason_in_comments` is enabled, the
 * audit logger also posts a brief explanation to the relevant issue
 * or pull request so maintainers can see *why* an action was taken.
 *
 * This is the single source of truth for transparency in the App.
 */

const { createLogger } = require('./helpers/logger');

/**
 * Creates an audit logger bound to the Probot application.
 *
 * @param {import('probot').Probot} application
 * @returns {object} An audit logger with `log` and `logAndComment` methods.
 */
function createAuditLogger(application) {
  const logger = createLogger(application, 'audit', { payload: {} });

  /**
   * Records a decision to the application log.
   *
   * @param {object} botContext - The bot context.
   * @param {string} moduleName - The module that made the decision.
   * @param {string} action - A short action identifier (e.g., 'assign', 'warn').
   * @param {object} details - Arbitrary structured data about the decision.
   */
  function log(botContext, moduleName, action, details) {
    logger.info({
      module: moduleName,
      action,
      owner: botContext.owner,
      repo: botContext.repo,
      issue_number: botContext.issue?.number ?? botContext.pullRequest?.number,
      details,
    }, `Audit: ${moduleName}.${action}`);
  }

  /**
   * Records a decision and optionally posts an explanatory comment.
   *
   * Comments are only posted when `audit.include_reason_in_comments` is true
   * and the botContext points to an issue or pull request.
   *
   * @param {object} botContext - The bot context.
   * @param {string} moduleName - The module that made the decision.
   * @param {string} action - A short action identifier.
   * @param {string} reason - A human-readable explanation.
   * @param {object} details - Structured data about the decision.
   */
  async function logAndComment(botContext, moduleName, action, reason, details) {
    log(botContext, moduleName, action, details);

    if (!botContext.config.audit.include_reason_in_comments) {
      return;
    }

    const issueNumber = botContext.issue?.number ?? botContext.pullRequest?.number;
    if (!issueNumber) {
      return;
    }

    try {
      await botContext.github.issues.createComment({
        owner: botContext.owner,
        repo: botContext.repo,
        issue_number: issueNumber,
        body: `> 🤖 **Hiero Bot** — ${moduleName}: ${action}\n>\n> ${reason}`,
      });
    } catch (error) {
      logger.warn({ error: error.message }, 'Failed to post audit comment');
    }
  }

  return {
    log,
    logAndComment,
  };
}

module.exports = {
  createAuditLogger,
};

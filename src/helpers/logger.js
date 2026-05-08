// SPDX-License-Identifier: Apache-2.0

/**
 * Centralized logging helper.
 *
 * Wraps Probot's built-in logger with a consistent prefix pattern so that
 * every log line identifies which module and repository triggered it.
 *
 * The logger is intentionally thin. For a long-term project, structured
 * logging (JSON) is preferred over human-readable strings because it makes
 * log aggregation and querying straightforward.
 */

/**
 * Creates a child logger bound to a specific module and repository context.
 *
 * @param {import('probot').Probot} application - The Probot app (provides the base logger).
 * @param {string} moduleName - The name of the module producing the log (e.g., 'assignment').
 * @param {object} context - The Probot event context (used to extract owner/repo).
 * @returns {import('probot').Logger} A child logger with bound metadata.
 */
function createLogger(application, moduleName, context) {
  const payload = context?.payload ?? {};
  const repository = payload.repository;
  const owner = repository?.owner?.login ?? 'unknown';
  const repo = repository?.name ?? 'unknown';

  return application.log.child({
    module: moduleName,
    owner,
    repo,
    installation_id: payload.installation?.id,
  });
}

module.exports = {
  createLogger,
};

// SPDX-License-Identifier: Apache-2.0

/**
 * Inactivity module stub.
 *
 * Warns and closes stale assignments based on configured thresholds.
 * Full implementation will be added in a subsequent commit.
 */

async function handleSchedule(_botContext, moduleConfig, logger, _audit) {
  logger.debug({ moduleConfig }, 'Inactivity module received schedule event (stub)');
}

module.exports = {
  handleSchedule,
};

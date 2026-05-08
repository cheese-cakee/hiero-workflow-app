// SPDX-License-Identifier: Apache-2.0

/**
 * Bot context builder.
 *
 * Wraps the raw Probot context with commonly accessed properties so that
 * modules do not need to reach deep into the payload object. This mirrors
 * the `buildBotContext` helper used in the Hiero C++ SDK bot scripts.
 *
 * @param {import('probot').Context} probotContext - The Probot event context.
 * @param {object} config - The resolved repository configuration.
 * @returns {object} A bot context with convenient accessors.
 */
function buildBotContext(probotContext, config) {
  const payload = probotContext.payload;
  const repository = payload.repository;

  return {
    // Core Probot objects
    github: probotContext.octokit,
    context: probotContext,
    config: config,

    // Repository identity
    owner: repository?.owner?.login ?? null,
    repo: repository?.name ?? null,
    repositoryId: repository?.id ?? null,

    // Event payload (typed by event name)
    payload: payload,

    // Common payload shortcuts
    issue: payload.issue ?? null,
    pullRequest: payload.pull_request ?? null,
    comment: payload.comment ?? null,
    review: payload.review ?? null,
    sender: payload.sender ?? null,

    // Installation info
    installationId: payload.installation?.id ?? null,
  };
}

module.exports = {
  buildBotContext,
};

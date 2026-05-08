// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the bot context builder.
 */

const { buildBotContext } = require('../../src/helpers/context');

describe('buildBotContext', () => {
  let probotContext;
  let config;

  beforeEach(() => {
    probotContext = {
      octokit: { rest: 'mock-octokit' },
      payload: {
        repository: {
          owner: { login: 'hiero-ledger' },
          name: 'hiero-sdk-cpp',
          id: 123,
        },
        issue: { number: 42 },
        pull_request: { number: 101 },
        comment: { id: 999 },
        review: { state: 'approved' },
        sender: { login: 'contributor' },
        installation: { id: 1 },
      },
    };
    config = { assignment: { enabled: true } };
  });

  test('maps octokit to github property', () => {
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.github).toBe(probotContext.octokit);
  });

  test('preserves config reference', () => {
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.config).toBe(config);
  });

  test('extracts repository owner and name', () => {
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.owner).toBe('hiero-ledger');
    expect(ctx.repo).toBe('hiero-sdk-cpp');
    expect(ctx.repositoryId).toBe(123);
  });

  test('extracts issue from payload', () => {
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.issue).toEqual({ number: 42 });
  });

  test('extracts pull request from payload', () => {
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.pullRequest).toEqual({ number: 101 });
  });

  test('extracts comment from payload', () => {
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.comment).toEqual({ id: 999 });
  });

  test('extracts review from payload', () => {
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.review).toEqual({ state: 'approved' });
  });

  test('extracts sender from payload', () => {
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.sender).toEqual({ login: 'contributor' });
  });

  test('extracts installation id', () => {
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.installationId).toBe(1);
  });

  test('returns null for missing repository owner', () => {
    probotContext.payload.repository.owner = undefined;
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.owner).toBeNull();
  });

  test('returns null for missing repository name', () => {
    probotContext.payload.repository.name = undefined;
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.repo).toBeNull();
  });

  test('returns null for missing optional payload fields', () => {
    probotContext.payload.issue = undefined;
    probotContext.payload.pull_request = undefined;
    probotContext.payload.comment = undefined;
    probotContext.payload.review = undefined;
    probotContext.payload.sender = undefined;

    const ctx = buildBotContext(probotContext, config);
    expect(ctx.issue).toBeNull();
    expect(ctx.pullRequest).toBeNull();
    expect(ctx.comment).toBeNull();
    expect(ctx.review).toBeNull();
    expect(ctx.sender).toBeNull();
  });

  test('returns null for missing installation', () => {
    probotContext.payload.installation = undefined;
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.installationId).toBeNull();
  });

  test('returns null for missing repository id', () => {
    probotContext.payload.repository.id = undefined;
    const ctx = buildBotContext(probotContext, config);
    expect(ctx.repositoryId).toBeNull();
  });
});

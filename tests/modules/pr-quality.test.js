// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the PR Quality module.
 */

const prQualityModule = require('../../src/modules/pr-quality');
const checks = require('../../src/modules/pr-quality/checks');
const dashboard = require('../../src/modules/pr-quality/dashboard');

// Mock only the dashboard's upsert function so we don't hit the API.
jest.mock('../../src/modules/pr-quality/dashboard', () => ({
  ...jest.requireActual('../../src/modules/pr-quality/dashboard'),
  upsertDashboardComment: jest.fn(),
}));

describe('PR Quality module', () => {
  let botContext;
  let moduleConfig;
  let logger;
  let audit;

  beforeEach(() => {
    jest.clearAllMocks();

    botContext = {
      owner: 'hiero-ledger',
      repo: 'hiero-sdk-cpp',
      pullRequest: {
        number: 101,
        draft: false,
        title: 'feat: add new feature',
        body: 'Fixes #42',
      },
      github: {},
    };

    moduleConfig = {
      enabled: true,
      unified_dashboard: true,
      checks: {
        dco: true,
        gpg: true,
        merge_conflict: true,
        linked_issue: true,
        conventional_title: true,
        linked_issue_assigned: true,
      },
      auto_label: true,
      draft_explainer: true,
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    audit = {
      log: jest.fn(),
      logAndComment: jest.fn(),
    };
  });

  test('runs all checks and updates dashboard on PR open', async () => {
    botContext.github = {
      pulls: { listCommits: jest.fn().mockResolvedValue({ data: [] }) },
      issues: {
        get: jest.fn().mockResolvedValue({ data: { assignees: [{ login: 'user' }] } }),
        listComments: jest.fn().mockResolvedValue({ data: [] }),
        createComment: jest.fn().mockResolvedValue({}),
      },
    };

    await prQualityModule.handlePullRequestOpened(botContext, moduleConfig, logger, audit);

    expect(dashboard.upsertDashboardComment).toHaveBeenCalledWith(
      botContext,
      expect.stringContaining('PR Quality Dashboard'),
    );
    expect(audit.log).toHaveBeenCalled();
  });

  test('skips disabled checks', async () => {
    moduleConfig.checks.dco = false;
    moduleConfig.checks.gpg = false;

    botContext.github = {
      pulls: { listCommits: jest.fn().mockResolvedValue({ data: [] }) },
      issues: {
        get: jest.fn().mockResolvedValue({ data: { assignees: [] } }),
        listComments: jest.fn().mockResolvedValue({ data: [] }),
        createComment: jest.fn().mockResolvedValue({}),
      },
    };

    await prQualityModule.handlePullRequestEdited(botContext, moduleConfig, logger, audit);

    // The dashboard should still be updated, just with fewer checks.
    expect(dashboard.upsertDashboardComment).toHaveBeenCalled();
  });

  test('passes draft state to dashboard builder', async () => {
    botContext.pullRequest.draft = true;

    botContext.github = {
      pulls: { listCommits: jest.fn().mockResolvedValue({ data: [] }) },
      issues: {
        get: jest.fn().mockResolvedValue({ data: { assignees: [{ login: 'user' }] } }),
        listComments: jest.fn().mockResolvedValue({ data: [] }),
        createComment: jest.fn().mockResolvedValue({}),
      },
    };

    await prQualityModule.handlePullRequestOpened(botContext, moduleConfig, logger, audit);

    expect(dashboard.upsertDashboardComment).toHaveBeenCalledWith(
      botContext,
      expect.stringContaining('draft'),
    );
  });
});

describe('PR Quality checks', () => {
  let botContext;

  beforeEach(() => {
    botContext = {
      owner: 'hiero-ledger',
      repo: 'hiero-sdk-cpp',
      pullRequest: { number: 101 },
      github: {
        pulls: { listCommits: jest.fn() },
        issues: { get: jest.fn() },
      },
    };
  });

  describe('checkDco', () => {
    test('passes when all commits have sign-off', async () => {
      botContext.github.pulls.listCommits.mockResolvedValue({
        data: [
          { commit: { message: 'feat: x\n\nSigned-off-by: User <user@example.com>' } },
        ],
      });

      const result = await checks.checkDco(botContext);
      expect(result.passed).toBe(true);
    });

    test('fails when a commit lacks sign-off', async () => {
      botContext.github.pulls.listCommits.mockResolvedValue({
        data: [
          { commit: { message: 'feat: x' } },
        ],
      });

      const result = await checks.checkDco(botContext);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('missing DCO');
    });
  });

  describe('checkGpg', () => {
    test('passes when all commits are verified', async () => {
      botContext.github.pulls.listCommits.mockResolvedValue({
        data: [
          { commit: { verification: { verified: true } } },
        ],
      });

      const result = await checks.checkGpg(botContext);
      expect(result.passed).toBe(true);
    });

    test('fails when a commit is unverified', async () => {
      botContext.github.pulls.listCommits.mockResolvedValue({
        data: [
          { commit: { verification: { verified: false } } },
        ],
      });

      const result = await checks.checkGpg(botContext);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkMergeConflict', () => {
    test('passes when mergeable is true', async () => {
      botContext.pullRequest.mergeable = true;
      const result = await checks.checkMergeConflict(botContext);
      expect(result.passed).toBe(true);
    });

    test('fails when mergeable is false', async () => {
      botContext.pullRequest.mergeable = false;
      const result = await checks.checkMergeConflict(botContext);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('conflicts');
    });

    test('fails with pending message when mergeable is null', async () => {
      botContext.pullRequest.mergeable = null;
      const result = await checks.checkMergeConflict(botContext);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('pending');
    });
  });

  describe('checkLinkedIssue', () => {
    test('passes when PR body references an issue', async () => {
      botContext.pullRequest.body = 'This fixes #42';
      const result = await checks.checkLinkedIssue(botContext);
      expect(result.passed).toBe(true);
      expect(result.issueNumber).toBe(42);
    });

    test('fails when PR body has no issue reference', async () => {
      botContext.pullRequest.body = 'Just some changes';
      const result = await checks.checkLinkedIssue(botContext);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkConventionalTitle', () => {
    test('passes for valid conventional commit title', async () => {
      botContext.pullRequest.title = 'feat(scope): add feature';
      const result = await checks.checkConventionalTitle(botContext);
      expect(result.passed).toBe(true);
    });

    test('fails for invalid title', async () => {
      botContext.pullRequest.title = 'Add feature';
      const result = await checks.checkConventionalTitle(botContext);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkLinkedIssueAssigned', () => {
    test('passes when issue has assignees', async () => {
      botContext.github.issues.get.mockResolvedValue({
        data: { assignees: [{ login: 'user' }] },
      });

      const result = await checks.checkLinkedIssueAssigned(botContext, 42);
      expect(result.passed).toBe(true);
    });

    test('fails when issue has no assignees', async () => {
      botContext.github.issues.get.mockResolvedValue({
        data: { assignees: [] },
      });

      const result = await checks.checkLinkedIssueAssigned(botContext, 42);
      expect(result.passed).toBe(false);
    });
  });
});

describe('Dashboard builder', () => {
  test('builds markdown body with marker', () => {
    const results = {
      'DCO': { passed: true },
      'GPG': { passed: false, details: '1 commit unverified' },
    };

    const body = dashboard.buildDashboardBody(results, false);

    expect(body).toContain('<!-- hiero-bot-pr-dashboard -->');
    expect(body).toContain('✅ Pass');
    expect(body).toContain('❌ Fail');
    expect(body).toContain('1 commit unverified');
  });

  test('includes draft notice when PR is draft', () => {
    const body = dashboard.buildDashboardBody({}, true);
    expect(body).toContain('draft');
  });

  test('excludes draft notice when PR is not draft', () => {
    const body = dashboard.buildDashboardBody({}, false);
    expect(body).not.toContain('This PR is a **draft**');
  });

  test('handles empty results map', () => {
    const body = dashboard.buildDashboardBody({}, false);
    expect(body).toContain('| Check | Status |');
  });
});

describe('PR Quality check error paths', () => {
  let botContext;

  beforeEach(() => {
    botContext = {
      owner: 'hiero-ledger',
      repo: 'hiero-sdk-cpp',
      pullRequest: { number: 101 },
      github: {
        pulls: { listCommits: jest.fn() },
        issues: { get: jest.fn() },
      },
    };
  });

  test('checkDco returns fail when listCommits API errors', async () => {
    botContext.github.pulls.listCommits.mockRejectedValue(new Error('API Error'));

    const result = await checks.checkDco(botContext);
    expect(result.passed).toBe(false);
    expect(result.details).toBe('Could not verify DCO status');
  });

  test('checkGpg returns fail when listCommits API errors', async () => {
    botContext.github.pulls.listCommits.mockRejectedValue(new Error('API Error'));

    const result = await checks.checkGpg(botContext);
    expect(result.passed).toBe(false);
    expect(result.details).toBe('Could not verify GPG status');
  });

  test('checkLinkedIssue fails when PR body is null', async () => {
    botContext.pullRequest.body = null;

    const result = await checks.checkLinkedIssue(botContext);
    expect(result.passed).toBe(false);
  });

  test('checkLinkedIssue passes with bare issue reference', async () => {
    botContext.pullRequest.body = 'Related to #99';

    const result = await checks.checkLinkedIssue(botContext);
    expect(result.passed).toBe(true);
    expect(result.issueNumber).toBe(99);
  });

  test('checkConventionalTitle fails for null title', async () => {
    botContext.pullRequest.title = null;

    const result = await checks.checkConventionalTitle(botContext);
    expect(result.passed).toBe(false);
  });

  test('checkConventionalTitle passes for breaking change notation', async () => {
    botContext.pullRequest.title = 'feat!: drop legacy support';

    const result = await checks.checkConventionalTitle(botContext);
    expect(result.passed).toBe(true);
  });

  test('checkLinkedIssueAssigned returns fail when issues.get API errors', async () => {
    botContext.github.issues.get.mockRejectedValue(new Error('API Error'));

    const result = await checks.checkLinkedIssueAssigned(botContext, 42);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('Could not check');
  });
});

describe('PR Quality module edge cases', () => {
  let botContext;
  let moduleConfig;
  let logger;
  let audit;

  beforeEach(() => {
    jest.clearAllMocks();

    botContext = {
      owner: 'hiero-ledger',
      repo: 'hiero-sdk-cpp',
      pullRequest: {
        number: 101,
        draft: false,
        title: 'feat: add feature',
        body: 'Fixes #42',
      },
      github: {
        pulls: { listCommits: jest.fn() },
        issues: {
          get: jest.fn(),
          listComments: jest.fn(),
          createComment: jest.fn(),
        },
      },
    };

    moduleConfig = {
      enabled: true,
      checks: {
        dco: true,
        gpg: true,
        merge_conflict: true,
        linked_issue: true,
        conventional_title: true,
        linked_issue_assigned: true,
      },
    };

    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    audit = { log: jest.fn(), logAndComment: jest.fn() };
  });

  test('skips linked_issue_assigned when disabled in config', async () => {
    moduleConfig.checks.linked_issue_assigned = false;

    botContext.github.pulls.listCommits.mockResolvedValue({ data: [] });
    botContext.github.issues.get.mockResolvedValue({ data: { assignees: [] } });
    botContext.github.issues.listComments.mockResolvedValue({ data: [] });
    botContext.github.issues.createComment.mockResolvedValue({});

    await prQualityModule.handlePullRequestOpened(botContext, moduleConfig, logger, audit);

    const body = dashboard.upsertDashboardComment.mock.calls[0][1];
    expect(body).not.toContain('Linked Issue Assigned');
  });
});

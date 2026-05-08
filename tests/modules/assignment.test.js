// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the Assignment module.
 *
 * Mocks GitHub API helpers to verify that /assign and /unassign commands
 * enforce all gates correctly: issue state, labels, prerequisites,
 * assignment limits, and authorization.
 */

const assignmentModule = require('../../src/modules/assignment');
const { handleAssign } = require('../../src/modules/assignment/assign');
const { handleUnassign } = require('../../src/modules/assignment/unassign');

jest.mock('../../src/helpers/github', () => ({
  addAssignees: jest.fn(),
  removeAssignees: jest.fn(),
  createComment: jest.fn(),
  addReaction: jest.fn(),
  swapLabels: jest.fn(),
  addLabel: jest.fn(),
  removeLabel: jest.fn(),
  countIssuesByAssignee: jest.fn(),
  listAssignedIssues: jest.fn(),
  hasLabel: jest.fn((issue, labelName) => {
    return issue?.labels?.some((l) => l.name === labelName) ?? false;
  }),
}));

const githubHelpers = require('../../src/helpers/github');

describe('Assignment module', () => {
  let botContext;
  let moduleConfig;
  let logger;
  let audit;

  beforeEach(() => {
    jest.clearAllMocks();

    botContext = {
      owner: 'hiero-ledger',
      repo: 'hiero-sdk-cpp',
      issue: {
        number: 42,
        state: 'open',
        assignees: [],
        labels: [],
      },
      comment: {
        id: 999,
        body: '/assign',
        user: { login: 'contributor' },
      },
      github: {},
    };

    moduleConfig = {
      enabled: true,
      commands: ['/assign', '/unassign'],
      max_open_assignments: 2,
      cross_repo_prerequisites: true,
      status_labels: {
        ready: 'status: ready for dev',
        in_progress: 'status: in progress',
        blocked: 'status: blocked',
        needs_review: 'status: needs review',
      },
      skill_levels: {
        'skill: good first issue': {
          max_completions: 5,
          display_name: 'Good First Issue',
        },
        'skill: beginner': {
          prerequisites: {
            label: 'skill: good first issue',
            min_completed: 2,
          },
          display_name: 'Beginner',
        },
      },
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

    // Default: everything returns 0 (no completions, no open assignments)
    githubHelpers.countIssuesByAssignee.mockResolvedValue(0);
    githubHelpers.listAssignedIssues.mockResolvedValue([]);
  });

  describe('/assign command', () => {
    test('successfully assigns a user to a ready GFI issue', async () => {
      botContext.issue.labels = [
        { name: 'status: ready for dev' },
        { name: 'skill: good first issue' },
      ];

      githubHelpers.addAssignees.mockResolvedValue({ success: true });
      githubHelpers.swapLabels.mockResolvedValue({ success: true });
      githubHelpers.createComment.mockResolvedValue({ success: true });
      githubHelpers.addReaction.mockResolvedValue({ success: true });

      await handleAssign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addReaction).toHaveBeenCalledWith(botContext, 999, '+1');
      expect(githubHelpers.addAssignees).toHaveBeenCalledWith(botContext, ['contributor']);
      expect(githubHelpers.swapLabels).toHaveBeenCalledWith(
        botContext,
        'status: ready for dev',
        'status: in progress',
      );
      expect(githubHelpers.createComment).toHaveBeenCalled();
      expect(audit.logAndComment).toHaveBeenCalled();
    });

    test('rejects assignment when issue already has assignees', async () => {
      botContext.issue.assignees = [{ login: 'another-user' }];

      await handleAssign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addAssignees).not.toHaveBeenCalled();
      expect(githubHelpers.createComment).toHaveBeenCalledWith(
        botContext,
        expect.stringContaining('already assigned'),
      );
    });

    test('rejects assignment when issue lacks ready label', async () => {
      botContext.issue.labels = [{ name: 'skill: good first issue' }];

      await handleAssign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addAssignees).not.toHaveBeenCalled();
      expect(githubHelpers.createComment).toHaveBeenCalledWith(
        botContext,
        expect.stringContaining('not ready for assignment'),
      );
    });

    test('rejects assignment when issue has no skill level label', async () => {
      botContext.issue.labels = [{ name: 'status: ready for dev' }];

      await handleAssign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addAssignees).not.toHaveBeenCalled();
      expect(githubHelpers.createComment).toHaveBeenCalledWith(
        botContext,
        expect.stringContaining('does not have a recognized skill level label'),
      );
    });

    test('rejects assignment when prerequisites are not met', async () => {
      botContext.issue.labels = [
        { name: 'status: ready for dev' },
        { name: 'skill: beginner' },
      ];

      // No bypass: return 0 for all levels. Then prerequisite check returns 1 < 2.
      githubHelpers.countIssuesByAssignee.mockImplementation((_ctx, _user, _state, label) => {
        if (label === 'skill: good first issue') {return Promise.resolve(1);}
        return Promise.resolve(0);
      });

      await handleAssign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addAssignees).not.toHaveBeenCalled();
      expect(githubHelpers.createComment).toHaveBeenCalledWith(
        botContext,
        expect.stringContaining('need more experience'),
      );
    });

    test('rejects assignment when GFI completion cap is reached', async () => {
      botContext.issue.labels = [
        { name: 'status: ready for dev' },
        { name: 'skill: good first issue' },
      ];

      githubHelpers.countIssuesByAssignee.mockImplementation((_ctx, _user, _state, label) => {
        if (label === 'skill: good first issue') {return Promise.resolve(5);}
        return Promise.resolve(0);
      });

      await handleAssign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addAssignees).not.toHaveBeenCalled();
      expect(githubHelpers.createComment).toHaveBeenCalledWith(
        botContext,
        expect.stringContaining('reached the limit'),
      );
    });

    test('rejects assignment when open assignment limit is exceeded', async () => {
      botContext.issue.labels = [
        { name: 'status: ready for dev' },
        { name: 'skill: good first issue' },
      ];

      githubHelpers.countIssuesByAssignee.mockImplementation((_ctx, _user, _state, label) => {
        if (label === null) {return Promise.resolve(2);} // open assignments
        if (label === 'skill: good first issue') {return Promise.resolve(0);}
        return Promise.resolve(0);
      });

      githubHelpers.listAssignedIssues.mockResolvedValue([
        { labels: [{ name: 'status: in progress' }] },
      ]);

      await handleAssign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addAssignees).not.toHaveBeenCalled();
      expect(githubHelpers.createComment).toHaveBeenCalledWith(
        botContext,
        expect.stringContaining('assignment limit'),
      );
    });

    test('allows bypass when all open issues have needs-review PRs', async () => {
      botContext.issue.labels = [
        { name: 'status: ready for dev' },
        { name: 'skill: good first issue' },
      ];

      githubHelpers.countIssuesByAssignee.mockImplementation((_ctx, _user, _state, label) => {
        if (label === null) {return Promise.resolve(2);} // open assignments at limit
        return Promise.resolve(0);
      });

      githubHelpers.listAssignedIssues.mockResolvedValue([
        { labels: [{ name: 'status: needs review' }] },
      ]);

      githubHelpers.addAssignees.mockResolvedValue({ success: true });
      githubHelpers.swapLabels.mockResolvedValue({ success: true });
      githubHelpers.createComment.mockResolvedValue({ success: true });
      githubHelpers.addReaction.mockResolvedValue({ success: true });

      await handleAssign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addAssignees).toHaveBeenCalled();
    });
  });

  describe('/unassign command', () => {
    test('successfully unassigns the current assignee', async () => {
      botContext.comment.body = '/unassign';
      botContext.issue.assignees = [{ login: 'contributor' }];
      botContext.issue.labels = [{ name: 'status: in progress' }];

      githubHelpers.removeAssignees.mockResolvedValue({ success: true });
      githubHelpers.swapLabels.mockResolvedValue({ success: true });
      githubHelpers.createComment.mockResolvedValue({ success: true });
      githubHelpers.addReaction.mockResolvedValue({ success: true });

      await handleUnassign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.removeAssignees).toHaveBeenCalledWith(botContext, ['contributor']);
      expect(githubHelpers.swapLabels).toHaveBeenCalledWith(
        botContext,
        'status: in progress',
        'status: ready for dev',
      );
    });

    test('rejects unassignment when issue is closed', async () => {
      botContext.comment.body = '/unassign';
      botContext.issue.state = 'closed';

      await handleUnassign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.removeAssignees).not.toHaveBeenCalled();
    });

    test('rejects unassignment when user is not the assignee', async () => {
      botContext.comment.body = '/unassign';
      botContext.issue.assignees = [{ login: 'another-user' }];

      await handleUnassign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.removeAssignees).not.toHaveBeenCalled();
      expect(githubHelpers.createComment).toHaveBeenCalledWith(
        botContext,
        expect.stringContaining('not assigned'),
      );
    });

    test('rejects unassignment when issue has no assignees', async () => {
      botContext.comment.body = '/unassign';
      botContext.issue.assignees = [];

      await handleUnassign(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.removeAssignees).not.toHaveBeenCalled();
    });
  });

  describe('command parsing', () => {
    test('dispatches /assign command', async () => {
      botContext.issue.labels = [
        { name: 'status: ready for dev' },
        { name: 'skill: good first issue' },
      ];

      githubHelpers.addAssignees.mockResolvedValue({ success: true });
      githubHelpers.swapLabels.mockResolvedValue({ success: true });
      githubHelpers.createComment.mockResolvedValue({ success: true });
      githubHelpers.addReaction.mockResolvedValue({ success: true });

      await assignmentModule.handleComment(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addAssignees).toHaveBeenCalled();
    });

    test('ignores unknown commands', async () => {
      botContext.comment.body = '/random';

      await assignmentModule.handleComment(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.addAssignees).not.toHaveBeenCalled();
      expect(githubHelpers.removeAssignees).not.toHaveBeenCalled();
    });

    test('ignores disabled commands', async () => {
      moduleConfig.commands = ['/assign'];
      botContext.comment.body = '/unassign';

      await assignmentModule.handleComment(botContext, moduleConfig, logger, audit);

      expect(githubHelpers.removeAssignees).not.toHaveBeenCalled();
    });
  });
});

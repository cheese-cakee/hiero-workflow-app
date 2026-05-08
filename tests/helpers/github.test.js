// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the GitHub API helpers.
 */

jest.mock('../../src/helpers/context', () => ({
  getBotContext: jest.fn(),
}));

const {
  addReaction,
  createComment,
  addAssignees,
  removeAssignees,
  addLabel,
  removeLabel,
  swapLabels,
  hasLabel,
  countIssuesByAssignee,
  listAssignedIssues,
} = require('../../src/helpers/github');

describe('GitHub API helpers', () => {
  let botContext;

  beforeEach(() => {
    jest.clearAllMocks();

    botContext = {
      owner: 'hiero-ledger',
      repo: 'hiero-sdk-cpp',
      comment: { id: 999 },
      issue: {
        number: 42,
        labels: [],
      },
      github: {
        reactions: { createForIssueComment: jest.fn() },
        issues: {
          createComment: jest.fn(),
          addAssignees: jest.fn(),
          removeAssignees: jest.fn(),
          addLabels: jest.fn(),
          removeLabel: jest.fn(),
          listForRepo: jest.fn(),
        },
        rest: {
          search: {
            issuesAndPullRequests: jest.fn(),
          },
        },
      },
    };
  });

  describe('addReaction', () => {
    test('returns success on valid reaction', async () => {
      botContext.github.reactions.createForIssueComment.mockResolvedValue({});

      const result = await addReaction(botContext, 999, '+1');

      expect(result.success).toBe(true);
      expect(botContext.github.reactions.createForIssueComment).toHaveBeenCalledWith({
        owner: 'hiero-ledger',
        repo: 'hiero-sdk-cpp',
        comment_id: 999,
        content: '+1',
      });
    });

    test('returns failure on API error', async () => {
      botContext.github.reactions.createForIssueComment.mockRejectedValue(new Error('API Error'));

      const result = await addReaction(botContext, 999, 'hooray');

      expect(result.success).toBe(false);
    });
  });

  describe('createComment', () => {
    test('returns success on valid comment', async () => {
      botContext.github.issues.createComment.mockResolvedValue({});

      const result = await createComment(botContext, 'Hello world');

      expect(result.success).toBe(true);
      expect(botContext.github.issues.createComment).toHaveBeenCalledWith({
        owner: 'hiero-ledger',
        repo: 'hiero-sdk-cpp',
        issue_number: 42,
        body: 'Hello world',
      });
    });

    test('returns failure on API error', async () => {
      botContext.github.issues.createComment.mockRejectedValue(new Error('API Error'));

      const result = await createComment(botContext, 'Hello');

      expect(result.success).toBe(false);
    });
  });

  describe('addAssignees', () => {
    test('returns success when assignees added', async () => {
      botContext.github.issues.addAssignees.mockResolvedValue({});

      const result = await addAssignees(botContext, ['user1', 'user2']);

      expect(result.success).toBe(true);
      expect(botContext.github.issues.addAssignees).toHaveBeenCalledWith({
        owner: 'hiero-ledger',
        repo: 'hiero-sdk-cpp',
        issue_number: 42,
        assignees: ['user1', 'user2'],
      });
    });

    test('returns failure on API error', async () => {
      botContext.github.issues.addAssignees.mockRejectedValue(new Error('Forbidden'));

      const result = await addAssignees(botContext, ['user1']);

      expect(result.success).toBe(false);
    });
  });

  describe('removeAssignees', () => {
    test('returns success when assignees removed', async () => {
      botContext.github.issues.removeAssignees.mockResolvedValue({});

      const result = await removeAssignees(botContext, ['user1']);

      expect(result.success).toBe(true);
      expect(botContext.github.issues.removeAssignees).toHaveBeenCalledWith({
        owner: 'hiero-ledger',
        repo: 'hiero-sdk-cpp',
        issue_number: 42,
        assignees: ['user1'],
      });
    });

    test('returns failure on API error', async () => {
      botContext.github.issues.removeAssignees.mockRejectedValue(new Error('Forbidden'));

      const result = await removeAssignees(botContext, ['user1']);

      expect(result.success).toBe(false);
    });
  });

  describe('addLabel', () => {
    test('returns success when label added', async () => {
      botContext.github.issues.addLabels.mockResolvedValue({});

      const result = await addLabel(botContext, 'status: in progress');

      expect(result.success).toBe(true);
    });

    test('returns failure on API error', async () => {
      botContext.github.issues.addLabels.mockRejectedValue(new Error('Not Found'));

      const result = await addLabel(botContext, 'nonexistent');

      expect(result.success).toBe(false);
    });
  });

  describe('removeLabel', () => {
    test('returns success when label removed', async () => {
      botContext.github.issues.removeLabel.mockResolvedValue({});

      const result = await removeLabel(botContext, 'status: stale');

      expect(result.success).toBe(true);
    });

    test('returns failure on API error', async () => {
      botContext.github.issues.removeLabel.mockRejectedValue(new Error('Not Found'));

      const result = await removeLabel(botContext, 'nonexistent');

      expect(result.success).toBe(false);
    });
  });

  describe('swapLabels', () => {
    test('returns success when both label operations succeed', async () => {
      botContext.github.issues.addLabels.mockResolvedValue({});
      botContext.github.issues.removeLabel.mockResolvedValue({});

      const result = await swapLabels(botContext, 'old', 'new');

      expect(result.success).toBe(true);
    });

    test('returns failure with error details when remove fails', async () => {
      botContext.github.issues.removeLabel.mockRejectedValue(new Error('Not Found'));
      botContext.github.issues.addLabels.mockResolvedValue({});

      const result = await swapLabels(botContext, 'missing', 'new');

      expect(result.success).toBe(false);
      expect(result.error).toContain('remove');
    });
  });

  describe('hasLabel', () => {
    test('returns true when label exists', () => {
      botContext.issue.labels = [{ name: 'bug' }, { name: 'enhancement' }];
      expect(hasLabel(botContext.issue, 'bug')).toBe(true);
    });

    test('returns false when label is missing', () => {
      botContext.issue.labels = [{ name: 'bug' }];
      expect(hasLabel(botContext.issue, 'enhancement')).toBe(false);
    });

    test('returns false when issue has no labels', () => {
      expect(hasLabel(botContext.issue, 'anything')).toBe(false);
    });

    test('returns false when issue is null/undefined', () => {
      expect(hasLabel(null, 'anything')).toBe(false);
      expect(hasLabel(undefined, 'anything')).toBe(false);
    });
  });

  describe('countIssuesByAssignee', () => {
    test('returns count from search API', async () => {
      botContext.github.rest.search.issuesAndPullRequests.mockResolvedValue({
        data: { total_count: 3, items: [{}, {}, {}] },
      });

      const result = await countIssuesByAssignee(botContext, 'user', 'closed', 'bug', 10);

      expect(result).toBe(3);
      expect(botContext.github.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: expect.stringContaining('assignee:user'),
        per_page: 10,
      });
    });

    test('returns null on API error', async () => {
      botContext.github.rest.search.issuesAndPullRequests.mockRejectedValue(new Error('Rate Limited'));

      const result = await countIssuesByAssignee(botContext, 'user', 'open', null, 5);

      expect(result).toBeNull();
    });

    test('builds query without label filter when label is null', async () => {
      botContext.github.rest.search.issuesAndPullRequests.mockResolvedValue({
        data: { total_count: 0, items: [] },
      });

      await countIssuesByAssignee(botContext, 'user', 'open', null, 10);

      const callArg = botContext.github.rest.search.issuesAndPullRequests.mock.calls[0][0];
      expect(callArg.q).not.toContain('label:');
    });
  });

  describe('listAssignedIssues', () => {
    test('returns list of issues', async () => {
      const mockIssues = [{ number: 1 }, { number: 2 }];
      botContext.github.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const result = await listAssignedIssues(botContext, 'user');

      expect(result).toEqual(mockIssues);
      expect(botContext.github.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'hiero-ledger',
        repo: 'hiero-sdk-cpp',
        assignee: 'user',
        state: 'open',
        per_page: 100,
      });
    });

    test('returns null on API error', async () => {
      botContext.github.issues.listForRepo.mockRejectedValue(new Error('Network Error'));

      const result = await listAssignedIssues(botContext, 'user');

      expect(result).toBeNull();
    });
  });
});

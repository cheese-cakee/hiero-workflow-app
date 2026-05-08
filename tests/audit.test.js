// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the audit logger.
 */

jest.mock('../src/helpers/logger', () => ({
  createLogger: jest.fn(),
}));

const { createAuditLogger } = require('../src/audit');
const { createLogger } = require('../src/helpers/logger');

describe('createAuditLogger', () => {
  let mockLogger;
  let audit;
  let botContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    createLogger.mockReturnValue(mockLogger);

    const fakeApp = { log: {} };
    audit = createAuditLogger(fakeApp);

    botContext = {
      owner: 'hiero-ledger',
      repo: 'hiero-sdk-cpp',
      issue: { number: 42 },
      pullRequest: { number: 101 },
      config: {
        audit: {
          include_reason_in_comments: true,
        },
      },
      github: {
        issues: {
          createComment: jest.fn(),
        },
      },
    };
  });

  describe('log', () => {
    test('calls logger.info with structured payload', () => {
      audit.log(botContext, 'assignment', 'assigned', { user: 'contributor' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'assignment',
          action: 'assigned',
          owner: 'hiero-ledger',
          repo: 'hiero-sdk-cpp',
          issue_number: 42,
          details: { user: 'contributor' },
        }),
        'Audit: assignment.assigned',
      );
    });

    test('falls back to pullRequest number when issue is missing', () => {
      const prContext = { ...botContext, issue: undefined };

      audit.log(prContext, 'pr_quality', 'dashboard_updated', {});

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ issue_number: 101 }),
        expect.any(String),
      );
    });
  });

  describe('logAndComment', () => {
    test('logs and posts a comment when comments are enabled', async () => {
      botContext.github.issues.createComment.mockResolvedValue({});

      await audit.logAndComment(
        botContext,
        'assignment',
        'assigned',
        'Successfully assigned @contributor.',
        { user: 'contributor' },
      );

      expect(mockLogger.info).toHaveBeenCalled();
      expect(botContext.github.issues.createComment).toHaveBeenCalledWith({
        owner: 'hiero-ledger',
        repo: 'hiero-sdk-cpp',
        issue_number: 42,
        body: expect.stringContaining('Hiero Bot'),
      });
    });

    test('skips comment posting when audit comments are disabled', async () => {
      botContext.config.audit.include_reason_in_comments = false;

      await audit.logAndComment(botContext, 'module', 'action', 'reason', {});

      expect(mockLogger.info).toHaveBeenCalled();
      expect(botContext.github.issues.createComment).not.toHaveBeenCalled();
    });

    test('skips comment when no issue or PR number exists', async () => {
      botContext.issue = undefined;
      botContext.pullRequest = undefined;

      await audit.logAndComment(botContext, 'module', 'action', 'reason', {});

      expect(mockLogger.info).toHaveBeenCalled();
      expect(botContext.github.issues.createComment).not.toHaveBeenCalled();
    });

    test('handles comment creation failure gracefully', async () => {
      botContext.github.issues.createComment.mockRejectedValue(new Error('API Error'));

      await audit.logAndComment(botContext, 'module', 'action', 'reason', {});

      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'API Error' }),
        'Failed to post audit comment',
      );
    });
  });
});

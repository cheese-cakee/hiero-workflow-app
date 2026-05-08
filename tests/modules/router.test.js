// SPDX-License-Identifier: Apache-2.0

/**
 * Tests for the event router.
 *
 * Mocks Probot's application and context, then verifies that the router
 * loads configuration, dispatches to enabled modules, skips disabled ones,
 * and audits every event.
 */

const { createRouter } = require('../../src/router');

// Mock all modules so we can assert which handlers were called.
jest.mock('../../src/modules/assignment', () => ({
  handleComment: jest.fn(),
  handleReviewSubmitted: jest.fn(),
}));

jest.mock('../../src/modules/pr-quality', () => ({
  handlePullRequestOpened: jest.fn(),
  handlePullRequestEdited: jest.fn(),
  handlePullRequestSynchronized: jest.fn(),
}));

jest.mock('../../src/modules/inactivity', () => ({
  handleSchedule: jest.fn(),
}));

jest.mock('../../src/modules/onboarding', () => ({
  handleIssueOpened: jest.fn(),
  handlePullRequestOpened: jest.fn(),
}));

jest.mock('../../src/modules/escalation', () => ({
  handleComment: jest.fn(),
  handleIssueOpened: jest.fn(),
}));

jest.mock('../../src/config/loader', () => ({
  loadConfig: jest.fn(),
}));

const assignmentModule = require('../../src/modules/assignment');
const prQualityModule = require('../../src/modules/pr-quality');
const inactivityModule = require('../../src/modules/inactivity');
const onboardingModule = require('../../src/modules/onboarding');
const escalationModule = require('../../src/modules/escalation');
const { loadConfig } = require('../../src/config/loader');

describe('createRouter', () => {
  let application;
  let router;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();

    application = {
      log: {
        child: jest.fn().mockReturnValue({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
      },
    };

    mockContext = {
      payload: {
        repository: { owner: { login: 'hiero-ledger' }, name: 'hiero-sdk-cpp', id: 123 },
        installation: { id: 456 },
        issue: { number: 42 },
        comment: { id: 999, body: '/assign', user: { login: 'contributor' } },
        sender: { login: 'contributor' },
      },
      octokit: {
        issues: {
          createComment: jest.fn().mockResolvedValue({}),
        },
      },
    };

    router = createRouter(application);
  });

  function makeConfig(overrides = {}) {
    return {
      assignment: { enabled: false },
      pr_quality: { enabled: false },
      inactivity: { enabled: false },
      onboarding: { enabled: false },
      escalation: { enabled: false },
      progression: { enabled: false },
      ai_planning: { enabled: false },
      ai_review: { enabled: false },
      audit: { enabled: true, include_reason_in_comments: false, log_all_decisions: true },
      ...overrides,
    };
  }

  describe('handleIssueCommentCreated', () => {
    test('dispatches to enabled assignment module', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        assignment: { enabled: true },
      }));

      await router.handleIssueCommentCreated(mockContext);

      expect(assignmentModule.handleComment).toHaveBeenCalledTimes(1);
    });

    test('skips disabled assignment module', async () => {
      loadConfig.mockResolvedValue(makeConfig());

      await router.handleIssueCommentCreated(mockContext);

      expect(assignmentModule.handleComment).not.toHaveBeenCalled();
    });

    test('dispatches to enabled escalation module', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        escalation: { enabled: true },
      }));

      await router.handleIssueCommentCreated(mockContext);

      expect(escalationModule.handleComment).toHaveBeenCalledTimes(1);
    });

    test('survives errors in module handlers', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        assignment: { enabled: true },
        escalation: { enabled: true },
      }));

      assignmentModule.handleComment.mockRejectedValue(new Error('boom'));

      // Should not throw — error is caught by handleEvent wrapper.
      await expect(router.handleIssueCommentCreated(mockContext)).resolves.not.toThrow();
    });
  });

  describe('handlePullRequestOpened', () => {
    test('dispatches to enabled pr_quality and onboarding modules', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        pr_quality: { enabled: true },
        onboarding: { enabled: true },
      }));

      mockContext.payload.pull_request = { number: 101 };

      await router.handlePullRequestOpened(mockContext);

      expect(prQualityModule.handlePullRequestOpened).toHaveBeenCalledTimes(1);
      expect(onboardingModule.handlePullRequestOpened).toHaveBeenCalledTimes(1);
    });

    test('skips all modules when everything is disabled', async () => {
      loadConfig.mockResolvedValue(makeConfig());

      await router.handlePullRequestOpened(mockContext);

      expect(prQualityModule.handlePullRequestOpened).not.toHaveBeenCalled();
      expect(onboardingModule.handlePullRequestOpened).not.toHaveBeenCalled();
    });
  });

  describe('handleScheduleRepository', () => {
    test('dispatches to enabled inactivity module', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        inactivity: { enabled: true },
      }));

      await router.handleScheduleRepository(mockContext);

      expect(inactivityModule.handleSchedule).toHaveBeenCalledTimes(1);
    });

    test('skips inactivity when disabled', async () => {
      loadConfig.mockResolvedValue(makeConfig());

      await router.handleScheduleRepository(mockContext);

      expect(inactivityModule.handleSchedule).not.toHaveBeenCalled();
    });
  });

  describe('config loading', () => {
    test('loads config for every event', async () => {
      loadConfig.mockResolvedValue(makeConfig());

      await router.handleIssueCommentCreated(mockContext);
      expect(loadConfig).toHaveBeenCalledTimes(1);

      await router.handleIssueOpened(mockContext);
      expect(loadConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleIssueOpened', () => {
    test('dispatches to enabled escalation and onboarding modules', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        escalation: { enabled: true },
        onboarding: { enabled: true },
      }));

      await router.handleIssueOpened(mockContext);

      expect(escalationModule.handleIssueOpened).toHaveBeenCalledTimes(1);
      expect(onboardingModule.handleIssueOpened).toHaveBeenCalledTimes(1);
    });

    test('passes correct sub-config to escalation module', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        escalation: { enabled: true, rules: [{ notify_team: 'test' }] },
      }));

      await router.handleIssueOpened(mockContext);

      expect(escalationModule.handleIssueOpened).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ enabled: true, rules: [{ notify_team: 'test' }] }),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('handlePullRequestEdited', () => {
    test('dispatches to enabled pr_quality module', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        pr_quality: { enabled: true },
      }));

      await router.handlePullRequestEdited(mockContext);

      expect(prQualityModule.handlePullRequestEdited).toHaveBeenCalledTimes(1);
    });

    test('skips disabled pr_quality module', async () => {
      loadConfig.mockResolvedValue(makeConfig());

      await router.handlePullRequestEdited(mockContext);

      expect(prQualityModule.handlePullRequestEdited).not.toHaveBeenCalled();
    });
  });

  describe('handlePullRequestSynchronized', () => {
    test('dispatches to enabled pr_quality module', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        pr_quality: { enabled: true },
      }));

      await router.handlePullRequestSynchronized(mockContext);

      expect(prQualityModule.handlePullRequestSynchronized).toHaveBeenCalledTimes(1);
    });
  });

  describe('handlePullRequestReviewSubmitted', () => {
    test('dispatches to enabled assignment module', async () => {
      loadConfig.mockResolvedValue(makeConfig({
        assignment: { enabled: true },
      }));

      await router.handlePullRequestReviewSubmitted(mockContext);

      expect(assignmentModule.handleReviewSubmitted).toHaveBeenCalledTimes(1);
    });

    test('skips disabled assignment module', async () => {
      loadConfig.mockResolvedValue(makeConfig());

      await router.handlePullRequestReviewSubmitted(mockContext);

      expect(assignmentModule.handleReviewSubmitted).not.toHaveBeenCalled();
    });
  });
});

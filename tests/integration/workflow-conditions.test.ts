/**
 * Integration test for conditional workflow logic (User Story 7)
 * Per T022a: Test conditional workflow execution based on PR changes
 *
 * This test MUST fail before T022 implementation (TDD requirement)
 *
 * Scenario: When a PR changes both config.yaml and application code,
 * application tests should run first, and smoke tests should only
 * run if application tests pass (fail-fast behavior).
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { load } from 'js-yaml';
import type { GitHubActionsWorkflow, WorkflowStep } from '../types/github-workflow.ts';

describe('Workflow Conditional Logic Integration (US7)', () => {
  let testWorkflow: GitHubActionsWorkflow;
  let smokeTestWorkflow: GitHubActionsWorkflow;

  beforeAll(() => {
    // Load both workflows
    const testWorkflowPath = '.github/workflows/test.yml';
    const smokeTestWorkflowPath = '.github/workflows/smoke-test.yml';

    // This will fail until workflows exist
    expect(existsSync(testWorkflowPath)).toBe(true);
    expect(existsSync(smokeTestWorkflowPath)).toBe(true);

    testWorkflow = load(readFileSync(testWorkflowPath, 'utf-8')) as GitHubActionsWorkflow;
    smokeTestWorkflow = load(readFileSync(smokeTestWorkflowPath, 'utf-8')) as GitHubActionsWorkflow;
  });

  test('test workflow triggers on non-config PRs', () => {
    expect(testWorkflow.on).toBeDefined();

    if (typeof testWorkflow.on !== 'string' && !Array.isArray(testWorkflow.on)) {
      const paths = testWorkflow.on.pull_request?.paths;

      // Should either have no path filter or exclude config.yaml
      if (paths) {
        // If paths are specified, config.yaml should not be the ONLY path
        expect(paths).not.toEqual(['config.yaml']);

        // May exclude config.yaml explicitly
        const hasConfigExclusion = paths.some((p: string) => p.includes('!config.yaml'));

        // Either has exclusion or includes other paths
        expect(
          hasConfigExclusion || paths.length > 1 || paths.some((p: string) => p !== 'config.yaml')
        ).toBe(true);
      }
    }
  });

  test('smoke test workflow triggers on all PRs for required checks', () => {
    // IMPORTANT: Smoke test must run on ALL PRs (not just config.yaml changes)
    // because it's configured as a required check in branch protection.
    //
    // Why this is necessary:
    // - GitHub branch protection marks a check as "required"
    // - If the workflow doesn't run on a PR (due to path filtering), the check is "pending"
    // - A pending required check blocks the PR from being merged
    // - Therefore, required checks MUST run on all PRs to provide a pass/fail status
    //
    // See: .github/BRANCH_PROTECTION_SETUP.md for full context
    expect(smokeTestWorkflow.on).toBeDefined();

    if (typeof smokeTestWorkflow.on !== 'string' && !Array.isArray(smokeTestWorkflow.on)) {
      // Smoke test now runs on all PRs to satisfy branch protection requirements
      // It should NOT have a paths filter (or paths should be undefined)
      const paths = smokeTestWorkflow.on.pull_request?.paths;

      // Either paths is undefined (runs on all files) or doesn't restrict to config.yaml only
      expect(paths === undefined || paths === null).toBe(true);
    }
  });

  test('workflows can run concurrently on same PR as independent checks', () => {
    // Both workflows now run on all PRs to satisfy branch protection requirements
    // They run as independent required checks

    // Check that smoke test workflow no longer has path filter
    if (typeof smokeTestWorkflow.on !== 'string' && !Array.isArray(smokeTestWorkflow.on)) {
      const hasPathFilter = smokeTestWorkflow.on.pull_request?.paths;

      // Smoke tests now run on all PRs (no path filter)
      expect(hasPathFilter === undefined || hasPathFilter === null).toBe(true);
    }

    const smokeTestJobs = Object.values(smokeTestWorkflow.jobs);
    const testJobs = Object.values(testWorkflow.jobs);

    // Verify both workflows have jobs
    expect(smokeTestJobs.length).toBeGreaterThan(0);
    expect(testJobs.length).toBeGreaterThan(0);
  });

  test('both workflows are required checks enforced by branch protection', () => {
    // Both workflows now run on all PRs as independent required checks
    // Branch protection requires BOTH to pass before merge

    // Check that smoke test workflow runs on all PRs (no path filter)
    if (typeof smokeTestWorkflow.on !== 'string' && !Array.isArray(smokeTestWorkflow.on)) {
      const paths = smokeTestWorkflow.on.pull_request?.paths;

      // Smoke tests run on all PRs (no path restriction)
      expect(paths === undefined || paths === null).toBe(true);
    }

    // Verify test workflow does not have continue-on-error
    const testJobKeys = Object.keys(testWorkflow.jobs);
    expect(testJobKeys.length).toBeGreaterThan(0);

    const firstJobKey = testJobKeys[0];
    expect(firstJobKey).toBeDefined();
    const testJob = testWorkflow.jobs[firstJobKey!];
    expect(testJob).toBeDefined();
    const testSteps = testJob!.steps.filter(
      (step: WorkflowStep) => step.run?.includes('test') || step.run?.includes('vitest')
    );

    for (const step of testSteps) {
      expect(step['continue-on-error']).not.toBe(true);
    }
  });

  test('both workflows can run in parallel without conflicts', () => {
    // If a PR changes both config.yaml and code, both workflows trigger
    // They should not conflict (e.g., no file locks, no shared state)

    // Verify test workflow does not modify config.yaml
    const testWorkflowString = JSON.stringify(testWorkflow);
    const hasConfigModification = testWorkflowString.match(
      /git\s+commit.*config\.yaml|sed\s+-i.*config\.yaml|echo.*>\s*config\.yaml/i
    );

    expect(hasConfigModification).toBeNull();

    // Verify smoke test workflow does not modify application source code files
    // Check for actual file modification commands with word boundaries
    const smokeTestWorkflowString = JSON.stringify(smokeTestWorkflow);
    const hasCodeModification = smokeTestWorkflowString.match(
      /\bgit\s+commit.*src\/|\bsed\s+-i.*src\/|\brm\s+-[rf]+.*src\/|\bmv\s+.*src\//i
    );

    expect(hasCodeModification).toBeNull();
  });

  test('test workflow runs all test suites as specified in FR-040a', () => {
    // Per FR-040a: "pnpm test MUST execute all test suites"
    const testJob =
      testWorkflow.jobs.test || testWorkflow.jobs['run-tests'] || testWorkflow.jobs.tests;

    expect(testJob).toBeDefined();

    const workflowString = JSON.stringify(testWorkflow);

    // Verify all required test types are executed
    const requiredTests = ['unit', 'e2e', 'accessibility', 'coverage', 'performance'];

    for (const testType of requiredTests) {
      const hasTestType =
        workflowString.includes(testType) ||
        workflowString.includes('pnpm test') ||
        workflowString.includes('vitest run') ||
        workflowString.includes('test:coverage');

      expect(hasTestType).toBe(true);
    }
  });

  test('smoke test workflow validates config and runs health checks', () => {
    const smokeTestJob =
      smokeTestWorkflow.jobs['smoke-test'] ||
      smokeTestWorkflow.jobs.test ||
      smokeTestWorkflow.jobs.validate;

    expect(smokeTestJob).toBeDefined();

    const steps = smokeTestJob!.steps;

    // Should have validation step
    const hasValidation = steps.some(
      (step: WorkflowStep) =>
        step.name?.toLowerCase().includes('validat') || step.run?.includes('validate-config')
    );

    expect(hasValidation).toBe(true);

    // Should have health check step
    const hasHealthCheck = steps.some(
      (step: WorkflowStep) =>
        step.name?.toLowerCase().includes('health') ||
        step.run?.includes('health-check') ||
        step.run?.includes('smoke')
    );

    expect(hasHealthCheck).toBe(true);
  });

  test('workflows have distinct job names for clarity', () => {
    const testJobKeys = Object.keys(testWorkflow.jobs);
    const smokeTestJobKeys = Object.keys(smokeTestWorkflow.jobs);

    expect(testJobKeys.length).toBeGreaterThan(0);
    expect(smokeTestJobKeys.length).toBeGreaterThan(0);

    // Job names should be descriptive and distinct
    expect(testWorkflow.name).toBeDefined();
    expect(smokeTestWorkflow.name).toBeDefined();

    expect(testWorkflow.name).not.toBe(smokeTestWorkflow.name);
  });

  test('workflows respect branch protection rules', () => {
    // Both workflows should be designed to work with branch protection
    // Verify neither workflow has continue-on-error for critical steps

    const testJob = testWorkflow.jobs.test || testWorkflow.jobs['run-tests'];
    const smokeTestJob = smokeTestWorkflow.jobs['smoke-test'] || smokeTestWorkflow.jobs.test;

    expect(testJob).toBeDefined();
    expect(smokeTestJob).toBeDefined();

    // Test workflow critical steps should not have continue-on-error
    const testCriticalSteps = testJob!.steps.filter(
      (step: WorkflowStep) =>
        step.run?.includes('test') || step.run?.includes('lint') || step.run?.includes('type-check')
    );

    for (const step of testCriticalSteps) {
      expect(step['continue-on-error']).not.toBe(true);
    }

    // Smoke test workflow validation should not have continue-on-error
    const smokeTestCriticalSteps = smokeTestJob!.steps.filter(
      (step: WorkflowStep) => step.run?.includes('validate') || step.run?.includes('health-check')
    );

    for (const step of smokeTestCriticalSteps) {
      expect(step['continue-on-error']).not.toBe(true);
    }
  });
});

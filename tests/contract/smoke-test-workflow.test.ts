/**
 * Contract test for smoke test workflow (User Story 6)
 * Per T018a: Validate smoke test workflow structure and behavior
 *
 * This test MUST fail before T020 implementation (TDD requirement)
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import type { GitHubActionsWorkflow, WorkflowStep } from '../types/github-workflow.ts';

describe('Smoke Test Workflow Contract (US6)', () => {
  const workflowPath = '.github/workflows/smoke-test.yml';

  test('workflow file exists', () => {
    // This will fail until workflow is created in T020
    expect(() => readFileSync(workflowPath, 'utf-8')).not.toThrow();
  });

  test('workflow triggers on all PRs for required checks', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    // Verify pull_request trigger without path filter (runs on all PRs)
    expect(workflow.on).toBeDefined();
    if (typeof workflow.on !== 'string' && !Array.isArray(workflow.on)) {
      expect(workflow.on.pull_request).toBeDefined();

      // Should NOT have paths filter (so it runs on all PRs for branch protection)
      const paths = workflow.on.pull_request?.paths;
      expect(paths === undefined || paths === null).toBe(true);
    }
  });

  test('workflow has correct permissions per FR-037a', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    // Per FR-037a: Least-privilege principle
    expect(workflow.permissions).toBeDefined();
    expect(workflow.permissions?.contents).toBe('read');
    expect(workflow.permissions?.['pull-requests']).toBe('write');

    // Should not have excessive permissions
    expect(workflow.permissions?.actions).not.toBe('write');
    expect(workflow.permissions?.packages).not.toBe('write');
  });

  test('workflow executes config validation', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    expect(jobs).toBeDefined();

    // Find validation step
    const smokeTestJob = jobs['smoke-test'] || jobs.test || jobs.validate;
    expect(smokeTestJob).toBeDefined();

    const steps = smokeTestJob!.steps;
    const hasValidationStep = steps.some(
      (step: WorkflowStep) =>
        step.name?.toLowerCase().includes('validat') || step.run?.includes('config/validator')
    );

    expect(hasValidationStep).toBe(true);
  });

  test('workflow executes health checks for all services', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const smokeTestJob = jobs['smoke-test'] || jobs.test || jobs.validate;
    expect(smokeTestJob).toBeDefined();

    const steps = smokeTestJob!.steps;
    const hasHealthCheckStep = steps.some(
      (step: WorkflowStep) =>
        step.name?.toLowerCase().includes('health') ||
        step.run?.includes('health-check') ||
        step.run?.includes('smoke test')
    );

    expect(hasHealthCheckStep).toBe(true);
  });

  test('workflow posts Markdown comment with results table', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const smokeTestJob = jobs['smoke-test'] || jobs.test || jobs.validate;
    expect(smokeTestJob).toBeDefined();

    const steps = smokeTestJob!.steps;

    // Look for comment posting step
    const hasCommentStep = steps.some(
      (step: WorkflowStep) =>
        step.name?.toLowerCase().includes('comment') ||
        step.uses?.includes('actions/github-script') ||
        step.uses?.includes('marocchino/sticky-pull-request-comment')
    );

    expect(hasCommentStep).toBe(true);
  });

  test('workflow includes comment with required columns', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    // Check if workflow references a comment template or script
    const workflowString = JSON.stringify(workflow);

    // Required columns per T018a
    expect(workflowString).toMatch(/service|Service Name/i);
    expect(workflowString).toMatch(/status/i);
    expect(workflowString).toMatch(/latency/i);
    expect(workflowString).toMatch(/http.*code|status.*code/i);
    expect(workflowString).toMatch(/failure.*reason|error/i);
  });

  test('workflow fails if comment posting fails', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const smokeTestJob = jobs['smoke-test'] || jobs.test || jobs.validate;
    expect(smokeTestJob).toBeDefined();

    const steps = smokeTestJob!.steps;

    // Find comment posting step
    const commentStep = steps.find(
      (step: WorkflowStep) =>
        step.name?.toLowerCase().includes('comment') || step.uses?.includes('github-script')
    );

    // Verify step does not have continue-on-error: true
    if (commentStep) {
      expect(commentStep['continue-on-error']).not.toBe(true);
    }
  });

  test('workflow includes warning message for widespread failures', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for warning logic
    expect(
      workflowString.includes('warning') ||
        workflowString.includes('widespread') ||
        workflowString.includes('multiple')
    ).toBe(true);
  });

  test('workflow uses Node.js 22+', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const smokeTestJob = jobs['smoke-test'] || jobs.test || jobs.validate;
    expect(smokeTestJob).toBeDefined();

    const steps = smokeTestJob!.steps;

    // Find setup-node step
    const nodeStep = steps.find((step: WorkflowStep) => step.uses?.includes('actions/setup-node'));

    expect(nodeStep).toBeDefined();

    if (nodeStep?.with) {
      const nodeVersion = nodeStep.with['node-version'];

      // Accept various formats: '22', '22.x', '>=22', etc.
      if (typeof nodeVersion === 'string') {
        expect(
          nodeVersion === '22' ||
            nodeVersion === '22.x' ||
            nodeVersion === 'lts/*' ||
            nodeVersion.startsWith('22') ||
            nodeVersion.includes('>=22')
        ).toBe(true);
      }
    }
  });
});

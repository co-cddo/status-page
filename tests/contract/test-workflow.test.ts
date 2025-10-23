/**
 * Contract test for test workflow (User Story 7)
 * Per T019a: Validate test workflow structure and behavior
 *
 * This test MUST fail before T019 implementation (TDD requirement)
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import type { GitHubActionsWorkflow, WorkflowStep } from '../types/github-workflow.ts';

describe('Test Workflow Contract (US7)', () => {
  const workflowPath = '.github/workflows/test.yml';

  test('workflow file exists', () => {
    // This will fail until workflow is created in T019
    expect(() => readFileSync(workflowPath, 'utf-8')).not.toThrow();
  });

  test('workflow triggers on pull requests (non-config changes)', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    expect(workflow.on).toBeDefined();

    if (typeof workflow.on !== 'string' && !Array.isArray(workflow.on)) {
      expect(workflow.on.pull_request).toBeDefined();

      // Should NOT be limited to config.yaml only
      // Either no paths filter or paths excluding config.yaml
      const paths = workflow.on.pull_request?.paths;
      if (paths) {
        expect(paths).not.toEqual(['config.yaml']);
      }
    }
  });

  test('workflow has least-privilege permissions', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    // Per FR-037a: Explicit permissions only
    expect(workflow.permissions).toBeDefined();

    // For test workflow, only contents:read needed
    expect(workflow.permissions?.contents).toBe('read');

    // Should not have write permissions
    expect(workflow.permissions?.['pull-requests']).not.toBe('write');
    expect(workflow.permissions?.contents).not.toBe('write');
  });

  test('workflow executes unit tests', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    expect(jobs).toBeDefined();

    // Find test job
    const testJob = jobs.test || jobs['run-tests'] || jobs.tests;
    expect(testJob).toBeDefined();

    const steps = testJob!.steps;
    const hasTestStep = steps.some((step: WorkflowStep) =>
      step.name?.toLowerCase().includes('test') ||
      step.run?.includes('pnpm test') ||
      step.run?.includes('npm test') ||
      step.run?.includes('vitest')
    );

    expect(hasTestStep).toBe(true);
  });

  test('workflow executes e2e tests', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for e2e or playwright test execution
    expect(
      workflowString.includes('e2e') ||
      workflowString.includes('playwright') ||
      workflowString.includes('test:e2e')
    ).toBe(true);
  });

  test('workflow executes accessibility tests', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for accessibility test execution
    expect(
      workflowString.includes('accessibility') ||
      workflowString.includes('a11y') ||
      workflowString.includes('axe')
    ).toBe(true);
  });

  test('workflow enforces code coverage', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for coverage execution
    expect(
      workflowString.includes('coverage') ||
      workflowString.includes('test:coverage')
    ).toBe(true);
  });

  test('workflow executes performance tests', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for performance test execution
    expect(
      workflowString.includes('performance') ||
      workflowString.includes('perf') ||
      workflowString.includes('benchmark')
    ).toBe(true);
  });

  test('workflow blocks merge on test failure', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const testJob = jobs.test || jobs['run-tests'] || jobs.tests;
    expect(testJob).toBeDefined();

    // Verify no continue-on-error for test steps
    const testSteps = testJob!.steps.filter((step: WorkflowStep) =>
      step.run?.includes('test') || step.run?.includes('vitest')
    );

    for (const step of testSteps) {
      expect(step['continue-on-error']).not.toBe(true);
    }
  });

  test('workflow uses Node.js 22+', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const testJob = jobs.test || jobs['run-tests'] || jobs.tests;
    expect(testJob).toBeDefined();

    const steps = testJob!.steps;
    const nodeStep = steps.find((step: WorkflowStep) =>
      step.uses?.includes('actions/setup-node')
    );

    expect(nodeStep).toBeDefined();

    if (nodeStep?.with) {
      const nodeVersion = nodeStep.with['node-version'];

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

  test('workflow installs dependencies with pnpm', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for pnpm installation
    expect(
      workflowString.includes('pnpm') ||
      workflowString.includes('pnpm/action-setup')
    ).toBe(true);
  });

  test('workflow caches dependencies', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const testJob = jobs.test || jobs['run-tests'] || jobs.tests;
    expect(testJob).toBeDefined();

    const steps = testJob!.steps;
    const hasCacheStep = steps.some((step: WorkflowStep) =>
      step.uses?.includes('actions/cache') ||
      step.with?.['cache'] === 'pnpm' ||
      step.uses?.includes('setup-node-pnpm')  // Composite action that includes caching
    );

    expect(hasCacheStep).toBe(true);
  });

  test('workflow runs linting checks', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for linting execution
    expect(
      workflowString.includes('lint') ||
      workflowString.includes('eslint')
    ).toBe(true);
  });

  test('workflow runs type checking', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for type checking execution
    expect(
      workflowString.includes('type-check') ||
      workflowString.includes('tsc')
    ).toBe(true);
  });

  test('workflow has descriptive job names', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    // Workflow should have a descriptive name
    expect(workflow.name).toBeDefined();
    expect(workflow.name).toMatch(/test|ci|check/i);
  });

  test('workflow uploads coverage reports', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const testJob = jobs.test || jobs['run-tests'] || jobs.tests;
    expect(testJob).toBeDefined();

    const steps = testJob!.steps;
    const hasUploadStep = steps.some((step: WorkflowStep) =>
      step.uses?.includes('actions/upload-artifact') ||
      step.uses?.includes('codecov')
    );

    // Should upload coverage artifact
    expect(hasUploadStep).toBe(true);
  });
});

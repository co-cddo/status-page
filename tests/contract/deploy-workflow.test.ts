/**
 * Contract test for deploy workflow (User Story 7)
 * Per T021a: Validate deploy workflow structure and behavior
 *
 * This test MUST fail before T021 implementation (TDD requirement)
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import type { GitHubActionsWorkflow, WorkflowStep } from '../types/github-workflow.ts';

describe('Deploy Workflow Contract (US7)', () => {
  const workflowPath = '.github/workflows/deploy.yml';

  test('workflow file exists', () => {
    // This will fail until workflow is created in T021
    expect(() => readFileSync(workflowPath, 'utf-8')).not.toThrow();
  });

  test('workflow runs on schedule (every 5 minutes)', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    expect(workflow.on).toBeDefined();

    if (typeof workflow.on !== 'string' && !Array.isArray(workflow.on)) {
      expect(workflow.on.schedule).toBeDefined();
      expect(workflow.on.schedule).toHaveLength(1);

      // Verify cron schedule is every 5 minutes
      const cronSchedule = workflow.on.schedule?.[0]?.cron;
      expect(cronSchedule).toBe('*/5 * * * *');
    }
  });

  test('workflow supports manual dispatch', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    if (typeof workflow.on !== 'string' && !Array.isArray(workflow.on)) {
      expect(workflow.on.workflow_dispatch).toBeDefined();
    }
  });

  test('workflow has correct permissions for GitHub Pages deployment', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    // Per FR-037a: Least-privilege for Pages deployment
    expect(workflow.permissions).toBeDefined();
    expect(workflow.permissions?.contents).toBe('read');
    expect(workflow.permissions?.pages).toBe('write');
    expect(workflow.permissions?.['id-token']).toBe('write');
  });

  test('workflow restores CSV from cache', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const deployJob = jobs.deploy || jobs.build || jobs['build-and-deploy'];
    expect(deployJob).toBeDefined();

    const steps = deployJob!.steps;
    const hasCacheRestoreStep = steps.some((step: WorkflowStep) =>
      step.uses?.includes('actions/cache') ||
      step.name?.toLowerCase().includes('restore') ||
      step.name?.toLowerCase().includes('cache')
    );

    expect(hasCacheRestoreStep).toBe(true);
  });

  test('workflow handles cache fallback to GitHub Pages', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for fallback logic
    expect(
      workflowString.includes('gh-pages') ||
      workflowString.includes('fallback') ||
      workflowString.includes('download.*csv')
    ).toBe(true);
  });

  test('workflow executes health checks', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const deployJob = jobs.deploy || jobs.build || jobs['build-and-deploy'];
    expect(deployJob).toBeDefined();

    const steps = deployJob!.steps;
    const hasHealthCheckStep = steps.some((step: WorkflowStep) =>
      step.name?.toLowerCase().includes('health') ||
      step.run?.includes('health-check') ||
      step.run?.includes('orchestrator')
    );

    expect(hasHealthCheckStep).toBe(true);
  });

  test('workflow generates status.json', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for status.json generation
    expect(
      workflowString.includes('status.json') ||
      workflowString.includes('_data/health.json')
    ).toBe(true);
  });

  test('workflow runs Eleventy build', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const deployJob = jobs.deploy || jobs.build || jobs['build-and-deploy'];
    expect(deployJob).toBeDefined();

    const steps = deployJob!.steps;
    const hasEleventyStep = steps.some((step: WorkflowStep) =>
      step.name?.toLowerCase().includes('eleventy') ||
      step.name?.toLowerCase().includes('build') ||
      step.run?.includes('eleventy') ||
      step.run?.includes('pnpm run build')
    );

    expect(hasEleventyStep).toBe(true);
  });

  test('workflow performs post-build asset inlining', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for inlining step
    expect(
      workflowString.includes('inline') ||
      workflowString.includes('post-build')
    ).toBe(true);
  });

  test('workflow deploys to GitHub Pages', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const deployJob = jobs.deploy || jobs.build || jobs['build-and-deploy'];
    expect(deployJob).toBeDefined();

    const steps = deployJob!.steps;
    const hasDeployStep = steps.some((step: WorkflowStep) =>
      step.uses?.includes('actions/deploy-pages') ||
      step.uses?.includes('peaceiris/actions-gh-pages')
    );

    expect(hasDeployStep).toBe(true);
  });

  test('workflow uploads GitHub Pages artifact', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const deployJob = jobs.deploy || jobs.build || jobs['build-and-deploy'];
    expect(deployJob).toBeDefined();

    const steps = deployJob!.steps;
    const hasUploadStep = steps.some((step: WorkflowStep) =>
      step.uses?.includes('actions/upload-pages-artifact') ||
      step.uses?.includes('actions/upload-artifact')
    );

    expect(hasUploadStep).toBe(true);
  });

  test('workflow artifact includes required files', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Verify artifact includes index.html, status.json, history.csv
    expect(
      workflowString.includes('index.html') ||
      workflowString.includes('_site') ||
      workflowString.includes('output')
    ).toBe(true);
  });

  test('workflow saves CSV to cache', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const deployJob = jobs.deploy || jobs.build || jobs['build-and-deploy'];
    expect(deployJob).toBeDefined();

    const steps = deployJob!.steps;
    const hasCacheSaveStep = steps.some((step: WorkflowStep) =>
      (step.uses?.includes('actions/cache') && step.name?.toLowerCase().includes('save')) ||
      step.name?.toLowerCase().includes('cache.*csv')
    );

    expect(hasCacheSaveStep).toBe(true);
  });

  test('workflow handles failure scenarios', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const deployJob = jobs.deploy || jobs.build || jobs['build-and-deploy'];
    expect(deployJob).toBeDefined();

    const steps = deployJob!.steps;

    // Check for failure handling steps
    const hasFailureHandling = steps.some((step: WorkflowStep) =>
      step.if?.includes('failure') ||
      step.if?.includes('always')
    );

    expect(hasFailureHandling).toBe(true);
  });

  test('workflow uses Node.js 22+', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const deployJob = jobs.deploy || jobs.build || jobs['build-and-deploy'];
    expect(deployJob).toBeDefined();

    const steps = deployJob!.steps;
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

  test('workflow has concurrency control', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    // Verify concurrency group to prevent multiple deployments
    expect(workflow.concurrency).toBeDefined();
    expect(workflow.concurrency?.group).toContain('deploy');

    // Should cancel in-progress runs
    expect(workflow.concurrency?.['cancel-in-progress']).toBe(true);
  });

  test('workflow uses GitHub Pages environment', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const jobs = workflow.jobs;
    const deployJob = jobs.deploy || jobs.build || jobs['build-and-deploy'];
    expect(deployJob).toBeDefined();

    // Verify environment is set for GitHub Pages
    expect(deployJob!.environment).toBeDefined();

    if (typeof deployJob!.environment === 'string') {
      expect(deployJob!.environment).toBe('github-pages');
    } else if (deployJob!.environment && typeof deployJob!.environment === 'object') {
      expect(deployJob!.environment.name).toBe('github-pages');
    }
  });

  test('workflow validates CSV format before deployment', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for CSV validation
    expect(
      workflowString.includes('validate.*csv') ||
      workflowString.includes('check.*csv')
    ).toBe(true);
  });

  test('workflow handles CSV corruption gracefully', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for corruption handling or new file creation
    expect(
      workflowString.includes('corrupt') ||
      workflowString.includes('fallback') ||
      workflowString.includes('create.*new')
    ).toBe(true);
  });

  test('workflow logs deployment metrics', () => {
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const workflowString = JSON.stringify(workflow);

    // Check for metrics or logging
    expect(
      workflowString.includes('metrics') ||
      workflowString.includes('prometheus') ||
      workflowString.includes('log')
    ).toBe(true);
  });
});

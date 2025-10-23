/**
 * Integration test for workflow permissions (User Story 7)
 * Per T023a: Validate all workflows have explicit permissions per FR-037a
 *
 * This test MUST fail before T023 implementation (TDD requirement)
 */

import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import type { GitHubActionsWorkflow } from '../types/github-workflow.ts';

/**
 * Expected permissions for each workflow per FR-037a least-privilege principle
 */
const EXPECTED_PERMISSIONS: Record<string, Record<string, string>> = {
  'test.yml': {
    contents: 'read',
  },
  'smoke-test.yml': {
    contents: 'read',
    'pull-requests': 'write',
  },
  'deploy.yml': {
    contents: 'read',
    pages: 'write',
    'id-token': 'write',
  },
};

describe('Workflow Permissions Security (US7)', () => {
  const workflowsDir = '.github/workflows';

  test('workflows directory exists', () => {
    // This will fail until workflows are created
    expect(() => readdirSync(workflowsDir)).not.toThrow();
  });

  test('all workflows have explicit permissions section', () => {
    const workflowFiles = readdirSync(workflowsDir).filter((file) =>
      file.endsWith('.yml') || file.endsWith('.yaml')
    );

    expect(workflowFiles.length).toBeGreaterThan(0);

    for (const file of workflowFiles) {
      const workflowPath = join(workflowsDir, file);
      const workflowYaml = readFileSync(workflowPath, 'utf-8');
      const workflow = load(workflowYaml) as GitHubActionsWorkflow;

      // Every workflow MUST have explicit permissions
      expect(workflow.permissions).toBeDefined();
      expect(workflow.permissions).not.toBeNull();
    }
  });

  test('no workflows rely on default permissions', () => {
    const workflowFiles = readdirSync(workflowsDir).filter((file) =>
      file.endsWith('.yml') || file.endsWith('.yaml')
    );

    for (const file of workflowFiles) {
      const workflowPath = join(workflowsDir, file);
      const workflowYaml = readFileSync(workflowPath, 'utf-8');
      const workflow = load(workflowYaml) as GitHubActionsWorkflow;

      // Permissions must be explicitly set (not undefined)
      expect(workflow.permissions).toBeDefined();

      // If no permissions needed, should be set to {} or { contents: 'read' }
      if (Object.keys(workflow.permissions || {}).length === 0) {
        // Empty permissions object is acceptable
        expect(workflow.permissions).toEqual({});
      }
    }
  });

  test('test.yml has correct least-privilege permissions', () => {
    const workflowPath = join(workflowsDir, 'test.yml');
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const expected = EXPECTED_PERMISSIONS['test.yml'];
    expect(expected).toBeDefined();

    expect(workflow.permissions).toBeDefined();
    expect(workflow.permissions?.contents).toBe(expected!.contents);

    // Should not have write permissions
    expect(workflow.permissions?.['pull-requests']).not.toBe('write');
    expect(workflow.permissions?.pages).not.toBe('write');
  });

  test('smoke-test.yml has correct least-privilege permissions', () => {
    const workflowPath = join(workflowsDir, 'smoke-test.yml');
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const expected = EXPECTED_PERMISSIONS['smoke-test.yml'];
    expect(expected).toBeDefined();

    expect(workflow.permissions).toBeDefined();
    expect(workflow.permissions?.contents).toBe(expected!.contents);
    expect(workflow.permissions?.['pull-requests']).toBe(expected!['pull-requests']);

    // Should not have excessive permissions
    expect(workflow.permissions?.pages).not.toBe('write');
    expect(workflow.permissions?.actions).not.toBe('write');
  });

  test('deploy.yml has correct least-privilege permissions', () => {
    const workflowPath = join(workflowsDir, 'deploy.yml');
    const workflowYaml = readFileSync(workflowPath, 'utf-8');
    const workflow = load(workflowYaml) as GitHubActionsWorkflow;

    const expected = EXPECTED_PERMISSIONS['deploy.yml'];
    expect(expected).toBeDefined();

    expect(workflow.permissions).toBeDefined();
    expect(workflow.permissions?.contents).toBe(expected!.contents);
    expect(workflow.permissions?.pages).toBe(expected!.pages);
    expect(workflow.permissions?.['id-token']).toBe(expected!['id-token']);

    // Should not have unnecessary write permissions
    expect(workflow.permissions?.['pull-requests']).not.toBe('write');
    expect(workflow.permissions?.actions).not.toBe('write');
  });

  test('no workflow has contents: write permission', () => {
    const workflowFiles = readdirSync(workflowsDir).filter((file) =>
      file.endsWith('.yml') || file.endsWith('.yaml')
    );

    for (const file of workflowFiles) {
      const workflowPath = join(workflowsDir, file);
      const workflowYaml = readFileSync(workflowPath, 'utf-8');
      const workflow = load(workflowYaml) as GitHubActionsWorkflow;

      // No workflow should have contents: write
      expect(workflow.permissions?.contents).not.toBe('write');
    }
  });

  test('no workflow has excessive permissions', () => {
    const workflowFiles = readdirSync(workflowsDir).filter((file) =>
      file.endsWith('.yml') || file.endsWith('.yaml')
    );

    const dangerousPermissions = ['actions', 'packages', 'security-events', 'statuses', 'checks'];

    for (const file of workflowFiles) {
      const workflowPath = join(workflowsDir, file);
      const workflowYaml = readFileSync(workflowPath, 'utf-8');
      const workflow = load(workflowYaml) as GitHubActionsWorkflow;

      // Verify no dangerous permissions are set to 'write'
      for (const permission of dangerousPermissions) {
        expect(workflow.permissions?.[permission]).not.toBe('write');
      }
    }
  });

  test('workflows follow FR-037a security requirements', () => {
    const workflowFiles = readdirSync(workflowsDir).filter((file) =>
      file.endsWith('.yml') || file.endsWith('.yaml')
    );

    for (const file of workflowFiles) {
      const workflowPath = join(workflowsDir, file);
      const workflowYaml = readFileSync(workflowPath, 'utf-8');
      const workflow = load(workflowYaml) as GitHubActionsWorkflow;

      // FR-037a: "Define explicit permissions: section for each workflow"
      expect(workflow.permissions).toBeDefined();

      // FR-037a: "Use least-privilege principle"
      const permissionCount = Object.keys(workflow.permissions || {}).length;
      expect(permissionCount).toBeGreaterThanOrEqual(0);
      expect(permissionCount).toBeLessThanOrEqual(5); // Reasonable upper bound
    }
  });

  test('job-level permissions do not override workflow-level restrictions', () => {
    const workflowFiles = readdirSync(workflowsDir).filter((file) =>
      file.endsWith('.yml') || file.endsWith('.yaml')
    );

    for (const file of workflowFiles) {
      const workflowPath = join(workflowsDir, file);
      const workflowYaml = readFileSync(workflowPath, 'utf-8');
      const workflow = load(workflowYaml) as GitHubActionsWorkflow;

      // Check each job
      for (const [, job] of Object.entries(workflow.jobs)) {
        if (job.permissions) {
          // Job permissions should not grant more than workflow permissions
          const workflowPerms = workflow.permissions || {};
          const jobPerms = job.permissions || {};

          for (const [scope, level] of Object.entries(jobPerms)) {
            if (level === 'write') {
              // If job has write, workflow must also allow it
              expect(workflowPerms[scope]).toBe('write');
            }
          }
        }
      }
    }
  });

  test('all workflows are documented with permission rationale', () => {
    const workflowFiles = readdirSync(workflowsDir).filter((file) =>
      file.endsWith('.yml') || file.endsWith('.yaml')
    );

    for (const file of workflowFiles) {
      const workflowPath = join(workflowsDir, file);
      const workflowYaml = readFileSync(workflowPath, 'utf-8');

      // Workflow should have comments explaining permissions
      expect(
        workflowYaml.includes('# Permissions') ||
        workflowYaml.includes('# Per FR-037a') ||
        workflowYaml.includes('# Least-privilege')
      ).toBe(true);
    }
  });
});

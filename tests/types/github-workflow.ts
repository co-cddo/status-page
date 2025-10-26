/**
 * Shared TypeScript types for GitHub Actions workflow structure
 * Used across contract and integration tests
 */

export interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string | number | boolean>;
  'continue-on-error'?: boolean;
  if?: string;
}

export interface WorkflowJob {
  'runs-on'?: string | string[];
  steps: WorkflowStep[];
  permissions?: Record<string, string>;
  needs?: string | string[];
  environment?: string | { name: string; url?: string };
  if?: string;
  'timeout-minutes'?: number;
  container?:
    | string
    | {
        image: string;
        options?: string;
        credentials?: {
          username?: string;
          password?: string;
        };
        env?: Record<string, string>;
        ports?: number[];
        volumes?: string[];
      };
}

export interface WorkflowTrigger {
  pull_request?: {
    paths?: string[];
    branches?: string[];
    types?: string[];
  };
  push?: {
    paths?: string[];
    branches?: string[];
  };
  schedule?: Array<{ cron: string }>;
  workflow_dispatch?: Record<string, unknown>;
}

export interface GitHubActionsWorkflow {
  name?: string;
  on: WorkflowTrigger | string[];
  permissions?: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
  concurrency?: {
    group: string;
    'cancel-in-progress'?: boolean;
  };
}

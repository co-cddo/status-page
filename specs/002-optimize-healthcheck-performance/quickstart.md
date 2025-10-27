# Quickstart: Optimize Healthcheck Performance

This document provides instructions on how to run the optimized health check process.

## Prerequisites

- Node.js and pnpm installed.
- Project dependencies installed (`pnpm install`).

## Running the Health Checks

To run the health checks, execute the following command from the root of the project:

```bash
pnpm run check-once
```

This command will trigger the health check orchestrator, which will use a pool of child processes to execute the health checks in parallel.

## Configuration

The health check configuration is located in `config.yaml`. The number of concurrent checks can be configured in this file.

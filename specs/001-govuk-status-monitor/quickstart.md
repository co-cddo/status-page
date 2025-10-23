# Quickstart

This document provides instructions on how to set up and run the GOV.UK Public Services Status Monitor.

## Prerequisites

- Node.js v22+
- pnpm

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/user/repo.git
    cd repo
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```

## Configuration

1.  Create a `config.yaml` file in the root of the project.
2.  Add service configurations to the `pings` section of the `config.yaml` file. See `specs/001-govuk-status-monitor/spec.md` for the full configuration structure.

Example `config.yaml`:
```yaml
settings:
  check_interval: 60
pings:
  - name: "GOV.UK"
    protocol: HTTPS
    method: GET
    resource: "https://www.gov.uk"
    expected:
      status: 200
```

## Running the application

To run the application and generate the static assets:
```bash
pnpm run build
```
This will:
1.  Run the health check orchestrator.
2.  Write the results to `_data/health.json`.
3.  Invoke the 11ty build to generate the static site in the `_site` (or `dist`) directory.
4.  Run the post-build script to inline assets into the final `output` directory.

The generated status page will be available at `output/index.html`.
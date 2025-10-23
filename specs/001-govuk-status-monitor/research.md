# Research & Technical Decisions

This document summarizes the research and decisions made for the GOV.UK Public Services Status Monitor project.

## 1. 11ty GOV.UK Plugin Configuration

- **Decision**: Utilize the built-in features and layouts of the `@x-govuk/govuk-eleventy-plugin`, with customizations handled via SCSS overrides. All configuration will be centralized in `eleventy.config.js`.
- **Rationale**: This approach ensures compliance with GOV.UK Design System standards, reduces initial development effort, and improves long-term maintainability by leveraging the official plugin.
- **Alternatives Considered**: Implementing GOV.UK components manually, which would increase development time and risk of divergence from the design system.

## 2. Worker Threads Message Passing

- **Decision**: Use the standard `postMessage()` and `on('message')` pattern for communication between the main thread and worker threads. For large data payloads, the `transferList` option will be used to avoid cloning overhead.
- **Rationale**: This is the most common, straightforward, and well-documented method for message passing in Node.js worker threads. It provides a good balance of performance and ease of use.
- **Alternatives Considered**: `MessageChannel` (considered overly complex for this project's needs) and `SharedArrayBuffer` (which would introduce complex synchronization requirements).

## 3. CSV Format for Consecutive Failure Tracking

- **Decision**: The `history.csv` file will contain the columns: `timestamp`, `service_name`, `status`, `latency_ms`, `http_status_code`, `failure_reason`, and `correlation_id`. The consecutive failure count for a service will be derived at runtime by reading the last N records for that service from the CSV.
- **Rationale**: This approach keeps the CSV schema simple and avoids the complexity of maintaining a stateful counter column. It is sufficient for the current requirement of tracking two consecutive failures.
- **Alternatives Considered**: Adding a `consecutive_failure_count` column to the CSV, which would require more complex logic to update and maintain.

## 4. Post-Build Asset Inlining

- **Decision**: A custom Node.js script will be created to handle the inlining of CSS, JavaScript, and image assets into the final HTML file after the 11ty build is complete.
- **Rationale**: A custom script provides maximum control and transparency with zero additional npm dependencies. This is a critical consideration for a security-conscious public sector project, as it reduces supply chain risk.
- **Alternatives Considered**: Using webpack with plugins like `HtmlWebpackPlugin` or Gulp with `gulp-inline-source`. These were rejected due to the added complexity and dependency overhead.

## 5. GitHub Actions Artifact-Based Deployment

- **Decision**: The deployment to GitHub Pages will use a two-job GitHub Actions workflow. The `build` job will generate the static site and upload it as an artifact using `actions/upload-pages-artifact`. The `deploy` job will then download this artifact and deploy it to GitHub Pages using `actions/deploy-pages`.
- **Rationale**: This is the official, recommended, and most robust method for deploying sites with a build step to GitHub Pages. It provides a clear separation between the build and deployment processes.
- **Alternatives Considered**: Committing the built site to a `gh-pages` branch, which is an older, more complex, and less flexible approach.

## 6. Prometheus Metrics Cardinality Management

- **Decision**: Prometheus metrics will use a limited set of low-cardinality labels: `service_name` and `status`. Dynamic service tags will NOT be used as metric labels. Latency will be tracked using a histogram.
- **Rationale**: This strategy prevents cardinality explosion, ensuring the Prometheus instance remains performant and scalable. High-cardinality labels are a common cause of performance degradation in Prometheus.
- **Alternatives Considered**: Including all service tags as Prometheus labels, which was rejected due to the high risk of causing a cardinality explosion and impacting the stability of the monitoring system.
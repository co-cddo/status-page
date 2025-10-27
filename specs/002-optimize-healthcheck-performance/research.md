# Research: Optimize Healthcheck Performance

## Objective

To determine the best approach for parallelizing health checks in the Node.js application to reduce the overall execution time from ~30 minutes to under 2 minutes.

## Research Summary

The primary research focused on two main areas:

1.  **Parallelization Strategy**: Comparing Node.js `worker_threads` and `child_process` modules.
2.  **Process Pool Management**: Investigating existing libraries to manage a pool of workers or processes.

### Parallelization Strategy: Worker Threads vs. Child Processes

| Feature | Worker Threads | Child Processes |
| :--- | :--- | :--- |
| **Use Case** | CPU-bound tasks | I/O-bound tasks, running external programs |
| **Memory** | Shared memory space (optional via `SharedArrayBuffer`) | Separate memory space |
| **Overhead** | Lower overhead | Higher overhead (spawns a new process) |
| **Communication** | `postMessage()`, `SharedArrayBuffer` | IPC, `stdin`/`stdout`/`stderr` |
| **Isolation** | Less isolation (a crash can affect the main process) | More isolation (a crash in a child process doesn't affect the parent) |
| **Suitability for Health Checks** | Not ideal. Health checks are I/O-bound (network requests). | **Ideal**. Health checks are I/O-bound, and the isolation is beneficial. |

**Decision**: Use `child_process`.

**Rationale**: Health checks are I/O-bound network requests. The process isolation provided by child processes is a major advantage for robustness. A failure in one health check will not impact the others. While there is slightly more overhead in creating child processes, the benefits of isolation outweigh the costs for this use case.

### Process Pool Management

Several libraries were considered for managing a pool of child processes:

-   `multiprocess-pool`: A simple, dependency-free library for managing a pool of child processes.
-   `node-process-pool`: Another library specifically for managing process pools.
-   `f5io/pool`: A flexible but more complex pooling library.

**Decision**: Use `multiprocess-pool`.

**Rationale**: `multiprocess-pool` is simple, has no dependencies, and provides the necessary functionality to manage a pool of child processes for this use case. Its simplicity aligns with the project's goal of keeping the implementation straightforward and maintainable.

## Final Technical Approach

The implementation will use the `child_process` module to execute health checks in parallel. A pool of child processes will be managed by the `multiprocess-pool` library to efficiently distribute the health check tasks and limit the number of concurrent processes to the defined limit of 500.

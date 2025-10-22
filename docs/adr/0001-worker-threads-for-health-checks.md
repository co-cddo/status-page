# Worker Threads for Health Check Concurrency

**Status**: Accepted

**Date**: 2025-10-22

**Decision Makers**: Development Team

## Context

The GOV.UK Public Services Status Monitor needs to perform health checks against multiple services concurrently to minimize total check cycle time. According to FR-009a, the application must support concurrent health check execution using a worker pool.

The key requirements are:
- **Concurrent execution**: Check multiple services in parallel
- **Efficient resource usage**: Avoid blocking the main event loop
- **Scalability**: Handle 50-100+ services without degradation
- **TypeScript support**: Seamless integration with tsx runtime
- **Message passing**: Safe communication between workers
- **Auto-restart**: Recover from worker failures gracefully
- **I/O-bound workload**: Health checks are network operations, not CPU-intensive

From research.md: "Health checks are I/O bound, not CPU bound. Worker threads provide true parallelism for I/O operations by offloading network requests to separate threads."

## Decision

We will use **Node.js worker_threads module** for concurrent health check execution.

Worker pool configuration:
- **Pool size**: 2x CPU cores (configurable via `worker_pool_size` setting)
- **Worker lifecycle**: Auto-restart on failure
- **Message passing**: Typed WorkerMessage/WorkerResult interfaces
- **Correlation IDs**: UUID v4 for traceability
- **Timeout handling**: Per-task timeouts with graceful shutdown (30s max wait)

The orchestrator will:
1. Create a worker pool at startup
2. Distribute health checks across workers using a priority queue
3. Collect results via message passing
4. Manage worker lifecycle (start, monitor, restart)
5. Handle graceful shutdown

## Consequences

### Positive Consequences

- **True parallelism**: Worker threads execute in separate V8 isolates, enabling true concurrent I/O
- **Non-blocking**: Main thread remains responsive for scheduling and coordination
- **Isolation**: Worker crashes don't affect other workers or the main thread
- **TypeScript support**: tsx runtime handles TypeScript in worker threads seamlessly
- **Scalability**: Pool size adapts to available CPU cores
- **Performance**: I/O-bound operations benefit significantly from parallelization

### Negative Consequences

- **Message passing overhead**: Serialization/deserialization for inter-thread communication (~1-2ms per message)
- **Memory usage**: Each worker has its own V8 heap (~30MB minimum per worker)
- **Complexity**: Requires structured message passing and error handling patterns
- **Debugging**: Worker thread debugging is more complex than single-threaded code

## Alternatives Considered

### Option 1: async/await with Promise.allSettled()

**Description**: Execute all health checks concurrently using native async/await with Promise.allSettled() for parallel execution.

**Pros**:
- Zero dependencies (built-in)
- Simple programming model
- Low memory overhead
- Easy debugging

**Cons**:
- All operations share the same event loop
- CPU-intensive operations (if any) block all requests
- No isolation between checks
- Limited scalability for very large numbers of services

**Verdict**: Insufficient isolation. A single problematic health check (e.g., DNS timeout) could impact other concurrent checks on the same event loop.

### Option 2: Cluster module (process-based parallelism)

**Description**: Use Node.js cluster module to fork multiple processes.

**Pros**:
- True process isolation
- Can utilize all CPU cores
- Well-established pattern

**Cons**:
- Much higher memory overhead (~50MB+ per process)
- Complex inter-process communication (IPC)
- Overkill for I/O-bound operations
- Process spawning is slower than thread creation

**Verdict**: Too heavy. Cluster is designed for CPU-bound workloads like HTTP servers, not I/O-bound health checks.

### Option 3: Child processes (spawn/fork)

**Description**: Spawn child processes for each health check batch.

**Pros**:
- Maximum isolation
- Can use different Node.js versions per process

**Cons**:
- Very high overhead (process creation ~100ms+)
- Complex communication via stdin/stdout or IPC
- No TypeScript support without additional compilation
- Difficult error handling

**Verdict**: Unacceptable performance overhead. Process spawning latency would dominate health check time.

### Option 4: External job queue (Bull, BullMQ, RabbitMQ)

**Description**: Use an external job queue system to distribute health checks.

**Pros**:
- Horizontal scalability across multiple machines
- Robust retry and failure handling
- Persistent task storage

**Cons**:
- Requires external dependency (Redis for Bull/BullMQ, or RabbitMQ server)
- Significant operational complexity
- Network latency for job distribution
- Overkill for single-machine use case

**Verdict**: Over-engineered for MVP. External dependencies violate the self-contained architecture requirement.

## References

- [Node.js worker_threads Documentation](https://nodejs.org/api/worker_threads.html)
- [Context7 - Node.js Worker Threads Patterns](context7://nodejs/worker-threads-patterns)
- [research.md](../../specs/001-govuk-status-monitor/research.md) - Section 3: Health Check Implementation
- [spec.md FR-009a](../../specs/001-govuk-status-monitor/spec.md#functional-requirements) - Concurrent health check execution requirement
- [data-model.md](../../specs/001-govuk-status-monitor/data-model.md) - WorkerMessage and WorkerResult types

## Notes

**Implementation Location**: `src/orchestrator/worker-pool.ts`, `src/health-checks/worker.ts`

**Pool Sizing Rationale**: 2x CPU cores is optimal for I/O-bound workloads. Research shows that I/O operations benefit from over-subscription since threads spend most time waiting for network responses. For a 4-core machine, 8 workers allow maximum concurrency without excessive context switching.

**Future Considerations**: If the service scales beyond 100+ services, consider batching health checks or implementing a more sophisticated scheduling algorithm (e.g., weighted round-robin based on service priority).

**Security Note**: Worker threads share the same user permissions as the parent process. Ensure health check workers run with least-privilege principles.

# API Contracts

This directory contains the API contract specifications for the GOV.UK Public Services Status Monitor.

## Files

### `status-api.openapi.yaml`

OpenAPI 3.0.3 specification for the JSON Status API endpoint.

**Endpoint**: `/api/status.json`
**Method**: GET
**Response Format**: JSON array of service status objects

**Key Points**:
- Static JSON file (read-only API)
- Updated after each health check cycle
- Contains **current status only** (no historical data)
- Historical data available via `/history.csv`

## Validation

To validate the OpenAPI specification:

```bash
npx @redocly/cli lint contracts/status-api.openapi.yaml
```

## Documentation Generation

To generate interactive API documentation:

```bash
# Using Redoc
npx @redocly/cli build-docs contracts/status-api.openapi.yaml --output api-docs.html

# Using Swagger UI
npx swagger-ui-watcher contracts/status-api.openapi.yaml
```

## TypeScript Type Generation

To generate TypeScript types from the OpenAPI spec:

```bash
npx openapi-typescript contracts/status-api.openapi.yaml --output src/types/api.ts
```

## Contract Testing

Contract tests verify that the generated JSON API conforms to this specification:

```bash
npm test -- tests/contract/status-api.test.ts
```

## References

- [OpenAPI Specification](https://swagger.io/specification/)
- [Feature Specification](../spec.md)
- [Data Model](../data-model.md)

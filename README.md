# aether-ai-gateway

**Status:** Initial provider-neutral routing core implemented on a feature branch. No production deployment or provider selection is claimed.

## Implemented

- [Gateway source](src/index.js): explicit model-to-provider routing, required authorization callback, fail-closed authorization behavior, bounded request timeout, abort-signal propagation, and safe error normalization.
- [Unit tests](test/gateway.test.js): authorization denial, unconfigured model rejection, routing, timeout, and invalid configuration.
- Dependency-free Node.js package with Node 20/22 CI.

## Limitations

- This package does not authenticate principals; the caller must supply a principal from a trusted auth boundary.
- No provider-specific adapters, retries, fallback, quota enforcement, streaming protocol, or observability exporter are implemented yet.
- Route configuration is in-memory and must come from reviewed server-side configuration.
- Do not expose this boundary publicly until authentication, policy source, provider credentials, request limits, and integration tests are wired and reviewed.

## Documentation

- [Repository specification](docs/REPOSITORY_SPECIFICATION.md)
- [Project specification](docs/PROJECT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Dependencies and contracts](docs/DEPENDENCIES_AND_CONTRACTS.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Security review](docs/SECURITY_REVIEW.md)
- [Master catalog](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/REPOSITORY_CATALOG.md)

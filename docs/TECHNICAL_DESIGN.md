# Technical design — aether-ai-gateway

**Status:** design proposal; not implemented.

## Role

Gateway should normalize the product-facing model request while preserving provider capability differences.

## Proposed internal structure

Proposed pipeline: validate request -> authorize allowed deployment/model -> resolve capability metadata -> select provider adapter -> apply timeout/rate/quota policy -> stream/collect response -> normalize usage/error -> emit telemetry. A DIAL adapter can be evaluated as one upstream, not hardwired until ADR acceptance.

## Connections and ownership

Gateway -> providers through an adapter interface. Aether API/agents call gateway. Never let provider-specific SDK types leak into product API or frontend. Model fallback must not silently change privacy/quality/cost guarantees.

## Failure cases to design explicitly

- Invalid or unauthorized input.
- Dependency unavailable or responds with malformed/partial data.
- Timeout, cancellation, duplicate delivery/request, and retry exhaustion.
- Tenant or permission mismatch.
- Sensitive data accidentally entering logs or client-visible errors.

## Verification plan

Provider conformance tests, streamed and non-streamed tests, timeout/cancel tests, normalized error tests, unsupported-feature tests, rate-limit handling, and tests that secrets never appear in response/logs.

## Open decisions

- Final language/framework and packaging model.
- Runtime deployment boundary (repository does not imply a separate service).
- Selected dependency versions and license review.
- Production observability/retention limits and release criteria.

## Change-comment policy

When implementation begins, explain security invariants, state transitions, retry/idempotency constraints, and non-obvious integration behavior in comments. Keep the comment standard at [the project-wide guide](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/ENGINEERING_AND_COMMENTING_STANDARD.md).

## Related docs

- [Project specification](PROJECT_SPEC.md)
- [Architecture](ARCHITECTURE.md)
- [Dependencies and contracts](DEPENDENCIES_AND_CONTRACTS.md)
- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [Research and licenses](RESEARCH_AND_LICENSES.md)
- [Work log](WORKLOG.md)
- [Master repository spec](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/repositories/aether-ai-gateway.md)

## Gateway decision gate

Do not hardwire the implementation to DIAL Core or the DevKit provider package before ADR-0005 is accepted. Compare the options in the [master DIAL adoption evaluation](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/DIAL_ADOPTION_EVALUATION.md). Keep a stable Aether-owned request/response/stream/error/usage/capability contract and place upstream-specific mapping behind adapters. Only maintain a hybrid route if a proof-of-concept demonstrates a real requirement.

The current DevKit source review is recorded in [DevKit compatibility review](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/DEVKIT_COMPATIBILITY_REVIEW.md). It records the observed package versions, not registry integrity or a completed runtime test.

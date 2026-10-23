# Model Routing and Fallback Safety Contract

**Status:** proposed design contract only. No routing implementation, provider conformance, or runtime test is claimed present.

## Purpose and boundary

The Gateway owns model/deployment selection and provider-adapter normalization. Providers expose capability metadata; product API and agents consume the Aether-owned contract and must not depend on provider SDK types. Security policy remains authoritative for authorization. Billing remains authoritative for usage accounting. This document does not select a routing algorithm or provider.

## Routing inputs

A routing decision may consider only validated, policy-approved inputs:
- requested model/deployment or an explicitly configured routing profile;
- capabilities required by the caller (for example, streaming or tool calls);
- deployment availability and approved health signals;
- caller/tenant limits and applicable cost ceilings;
- data-handling constraints approved for the request;
- explicit operator configuration and versioned routing policy.

Do not infer authorization from a model name, prompt text, tool description, client-supplied tenant ID, or UI confirmation. Resolve the authenticated principal and authorization scope from trusted server-side context. Reject requests when required policy context is missing or inconsistent.

## Fallback invariants

Fallback is not an automatic permission to change the processing destination. Before switching, the candidate deployment must satisfy all applicable constraints:

1. **Authorization:** the caller is permitted to use the candidate deployment and capabilities.
2. **Data handling:** the candidate's approved processing/retention/residency classification is compatible with the request's constraints.
3. **Cost:** the candidate remains within the request and tenant's enforced cost limits; do not silently select a materially more expensive route.
4. **Capabilities:** required output mode and features remain supported. Unsupported tools, structured output, context size, or streaming must not be silently dropped.
5. **Quality and policy:** any caller-specified model/profile guarantees and policy restrictions remain satisfied.
6. **Accounting:** each actual provider attempt and billable usage record has a stable correlation/idempotency strategy; retries must not create duplicate usage charges or conceal billable attempts.
7. **Transparency:** return a stable route/fallback outcome and bounded reason category. Do not expose credentials, private provider errors, or sensitive routing metadata.

If no candidate satisfies every mandatory invariant, fail closed with a stable error category. Never downgrade data-handling constraints or bypass authorization merely to improve availability. If a request explicitly pins a deployment, treat that pin as a constraint unless the contract explicitly defines otherwise.

## Retry, timeout, and cancellation

- Retry only classified transient failures and within a bounded attempt/deadline budget.
- Do not retry non-idempotent side effects unless an idempotency mechanism prevents duplicate effects.
- Propagate cancellation to the adapter when supported; stop launching fallback attempts after cancellation or deadline expiry.
- Distinguish provider rejection, policy denial, timeout, cancellation, malformed response, and exhausted fallback in stable error categories.
- A partial stream followed by failure must not be presented as a clean successful completion. Define whether a new attempt is allowed after bytes have been delivered; default to no transparent replay after user-visible output unless a versioned streaming contract explicitly permits it.
- Normalize provider errors and usage metadata without passing raw upstream bodies into browser responses or ordinary logs.

## Decision record / observability

For each request, record a bounded routing outcome with correlation ID, policy/routing version, selected deployment identifier from an approved vocabulary, attempt count, outcome category, and usage reconciliation status. Avoid raw prompt/completion capture and unrestricted tenant/user identifiers in metric labels. Sensitive routing details belong only in appropriately access-controlled telemetry.

## Proposed acceptance matrix

These are proposed future tests, not tests already run.

| Scenario | Required result |
|---|---|
| Candidate deployment unauthorized | Deny before provider invocation |
| Candidate violates data-handling constraints | Skip candidate; do not relax constraints |
| Candidate exceeds cost ceiling | Reject candidate or fail request with stable category |
| Required capability unavailable | Reject candidate; do not silently remove capability |
| Pinned deployment unavailable | Honor pin and return bounded failure unless contract permits fallback |
| Transient failure before any output | Retry only within configured attempt/deadline budget |
| Failure after streamed bytes delivered | Do not silently restart and splice a second response |
| Caller cancellation | No new fallback attempt after cancellation |
| Malformed provider response | Normalize to stable error; do not leak raw body |
| Repeated request with idempotency key | No duplicate side effect or duplicate usage posting |
| Provider retry with billable partial usage | Preserve attempt accounting and reconcile without duplicate charge |
| All candidates excluded by policy | Fail closed; record bounded policy outcome |
| Fallback selection | Record selected candidate and bounded reason category |
| Prompt contains routing instructions | Treat as untrusted content, not routing authorization |
| Provider credential in exception | Absent from client response and default telemetry |

## Open decisions

The approved routing profile model, provider classification vocabulary, numerical cost thresholds, retry counts/deadlines, partial-stream behavior, usage reconciliation contract, and fallback disclosure requirements need cross-repository review and explicit decision records. ADR-0021 remains unresolved; this document does not assign canonical tenant/workspace membership ownership.

## Related documents

- [Gateway technical design](TECHNICAL_DESIGN.md)
- [Gateway security review](SECURITY_REVIEW.md)
- [Gateway dependencies and contracts](DEPENDENCIES_AND_CONTRACTS.md)
- [Security policy decision contract](https://github.com/Monupatel62/aether-ai-security/blob/main/docs/POLICY_DECISION_CONTRACT_AND_ACCEPTANCE.md)
- [Billing usage-event contract](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/BILLING_USAGE_EVENT_CONTRACT.md)

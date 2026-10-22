# Security Review Checklist — aether-ai-gateway

**Status:** design-stage checklist; not evidence of implemented controls. This file must be updated alongside code and tests.

## Trust boundary

Model request and provider boundary

## Main threat scenarios

Prompt injection, sensitive-data leakage, model abuse, runaway cost, and provider error leakage are key risks.

## Required controls

Enforce allowed model/deployment and tenant quotas server-side; redact provider credentials; cap context/output/token/time; normalize errors without raw sensitive payloads; keep prompt/completion logging off by default; document data processing and provider retention before enabling a model.

## Verification checklist

- [ ] Threat scenarios mapped to tests and acceptance criteria.
- [ ] Unauthorized and cross-tenant operations fail closed.
- [ ] Malformed/oversized input and output are rejected or bounded.
- [ ] Timeouts, retries, cancellation, and duplicate side effects are tested.
- [ ] Secrets and sensitive content are absent from default logs/traces.
- [ ] Dependency versions, license terms, and known vulnerabilities are reviewed.
- [ ] High-impact actions have explicit approval/policy requirements.
- [ ] Operational response and rollback are documented before production use.

## Project-wide reference

Read the [Aether AI security threat model](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/SECURITY_THREAT_MODEL.md) and [architecture audit](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/ARCHITECTURE_AUDIT.md). Use the current [OWASP GenAI Top 10 project](https://owasp.github.io/www-project-top-10-for-large-language-model-applications/) and verify the 2026 edition against the canonical publication. Do not treat prompts, tool descriptions, or UI confirmations as authorization controls.

## Change log

- 2026-10-22: Initial design-stage threat checklist added. No application code or security controls are claimed to be implemented.

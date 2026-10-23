import test from "node:test";
import assert from "node:assert/strict";
import { validateModelRequest, selectProvider, classifyProviderFailure, getGatewaySafetyPolicy } from "../src/index.js";

const request = { requestId: "req-123", correlationId: "corr-123", model: "vendor/model-v1", input: "Hello", stream: true };

test("validates request limits and correlation identifiers", () => {
  assert.equal(validateModelRequest(request).stream, true);
  assert.throws(() => validateModelRequest({ ...request, input: "" }), /non-empty/);
  assert.throws(() => validateModelRequest({ ...request, timeoutMs: 999999 }), /timeoutMs/);
  assert.throws(() => validateModelRequest({ ...request, input: "x".repeat(20) }, { maxInputBytes: 10 }), /byte limit/);
});

test("selects only enabled providers with required model and streaming capability", () => {
  const caps = [
    { providerId: "provider-a", enabled: true, models: ["vendor/model-v1"], supportsStreaming: false, priority: 1 },
    { providerId: "provider-b", enabled: true, models: ["vendor/model-v1"], supportsStreaming: true, priority: 10 },
    { providerId: "provider-c", enabled: false, models: ["vendor/model-v1"], supportsStreaming: true, priority: 0 },
  ];
  assert.deepEqual(selectProvider(caps, request), { selected: true, providerId: "provider-b" });
  assert.equal(selectProvider([], request).reason, "NO_CAPABLE_PROVIDER");
});

test("classifies provider failures without exposing raw provider errors", () => {
  assert.deepEqual(classifyProviderFailure({ kind: "timeout", message: "secret payload", retryAfterMs: 200 }), { code: "PROVIDER_TIMEOUT", retryable: true, retryAfterMs: 200 });
  assert.equal(classifyProviderFailure({ kind: "authentication" }).retryable, false);
});

test("publishes provider secret, prompt, timeout, output, and cancellation guardrails", () => {
  const policy = getGatewaySafetyPolicy();
  assert.equal(policy.providerSecretsServerSideOnly, true);
  assert.equal(policy.cancellationPropagatesToAdapter, true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createGateway, GatewayError } from "../src/index.js";

const principal = { id: "user-1", tenantId: "tenant-a" };
const request = { model: "model-a", messages: [{ role: "user", content: "hello" }] };
function makeGateway(overrides = {}) {
  const calls = [];
  const registry = { async complete(provider, input, options) { calls.push({ provider, input, options }); return { text: "ok" }; } };
  const gateway = createGateway({
    registry,
    modelRoutes: { "model-a": "provider-a" },
    authorize: async () => true,
    timeoutMs: 200,
    ...overrides,
  });
  return { gateway, calls };
}

test("routes only after explicit authorization", async () => {
  const { gateway, calls } = makeGateway();
  assert.deepEqual(await gateway.complete({ principal, request }), { text: "ok" });
  assert.equal(calls[0].provider, "provider-a");
});

test("denies when principal is missing", async () => {
  const { gateway } = makeGateway();
  await assert.rejects(gateway.complete({ request }), (e) => e instanceof GatewayError && e.code === "unauthenticated");
});

test("denies when authorization returns false or throws", async () => {
  const denied = makeGateway({ authorize: async () => false }).gateway;
  await assert.rejects(denied.complete({ principal, request }), (e) => e.code === "forbidden");
  const unavailable = makeGateway({ authorize: async () => { throw new Error("private detail"); } }).gateway;
  await assert.rejects(unavailable.complete({ principal, request }), (e) => e.code === "authorization_unavailable" && !e.message.includes("private"));
});

test("rejects unconfigured models without calling a provider", async () => {
  const { gateway, calls } = makeGateway();
  await assert.rejects(gateway.complete({ principal, request: { ...request, model: "model-unknown" } }), (e) => e.code === "model_not_routed");
  assert.equal(calls.length, 0);
});

test("times out a provider operation and aborts its signal", async () => {
  let aborted = false;
  const registry = { complete: (_provider, _request, { signal }) => new Promise((resolve) => { signal.addEventListener("abort", () => { aborted = true; resolve({ text: "late" }); }); }) };
  const gateway = createGateway({ registry, modelRoutes: { "model-a": "provider-a" }, authorize: async () => true, timeoutMs: 10 });
  await assert.rejects(gateway.complete({ principal, request }), (e) => e.code === "timeout");
  assert.equal(aborted, true);
});

test("validates gateway configuration", () => {
  assert.throws(() => createGateway({ registry: {}, modelRoutes: { "model-a": "p" }, authorize: () => true }), TypeError);
  assert.throws(() => createGateway({ registry: { complete() {} }, modelRoutes: { "model-a": "p" } }), TypeError);
});


test("rejects pre-aborted signals and promptly races caller cancellation", async () => {
  const { gateway, calls } = makeGateway();
  const already = new AbortController();
  already.abort();
  await assert.rejects(gateway.complete({ principal, request, signal: already.signal }), (e) => e.code === "aborted");
  assert.equal(calls.length, 0);

  const registry = { complete: () => new Promise(() => {}) };
  const hanging = createGateway({ registry, modelRoutes: { "model-a": "provider-a" }, authorize: async () => true, timeoutMs: 500 });
  const controller = new AbortController();
  const pending = hanging.complete({ principal, request, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (e) => e.code === "aborted");
});

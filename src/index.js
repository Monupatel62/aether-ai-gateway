/**
 * Aether gateway core. Provider wire protocols stay behind an injected registry.
 * No fallback is performed implicitly; routing and authorization are explicit.
 */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;

export class GatewayError extends Error {
  constructor(code, message = "Model request failed") {
    super(message);
    this.name = "GatewayError";
    this.code = code;
  }
}

function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function validId(value, field) {
  if (typeof value !== "string" || !MODEL_ID.test(value) || value.trim() !== value) throw new TypeError(`Invalid ${field}`);
  return value;
}

export function createGateway({ registry, modelRoutes, authorize, timeoutMs = 30_000 }) {
  if (!registry || typeof registry.complete !== "function") throw new TypeError("A provider registry is required");
  if (!isRecord(modelRoutes) || Object.keys(modelRoutes).length === 0) throw new TypeError("Explicit model routes are required");
  if (typeof authorize !== "function") throw new TypeError("An authorization function is required");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new TypeError("timeoutMs must be between 1 and 120000");

  const routes = new Map(Object.entries(modelRoutes).map(([model, provider]) => [
    validId(model, "route model"),
    validId(provider, "route provider"),
  ]));

  return Object.freeze({
    async complete({ principal, request, signal } = {}) {
      if (!isRecord(principal) || typeof principal.id !== "string" || typeof principal.tenantId !== "string") {
        throw new GatewayError("unauthenticated", "A trusted principal is required");
      }
      if (!isRecord(request)) throw new GatewayError("invalid_request", "A valid model request is required");
      const model = validId(request.model, "request model");
      const providerId = routes.get(model);
      if (!providerId) throw new GatewayError("model_not_routed", "Requested model is not configured");

      let authorized = false;
      try {
        authorized = (await authorize({ principal, action: "model:complete", model })) === true;
      } catch {
        throw new GatewayError("authorization_unavailable", "Authorization could not be verified");
      }
      if (!authorized) throw new GatewayError("forbidden", "Model request is not authorized");

      if (signal?.aborted) throw new GatewayError("aborted", "Model request was cancelled");
      const controller = new AbortController();
      const onAbort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", onAbort, { once: true });

      let timeoutId;
      let timedOut = false;
      try {
        const timeout = new Promise((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new GatewayError(timedOut ? "timeout" : "aborted", timedOut ? "Model request timed out" : "Model request was cancelled"));
          }, { once: true });
          timeoutId = setTimeout(() => {
            timedOut = true;
            controller.abort(new Error("Gateway request timed out"));
          }, timeoutMs);
        });
        const operation = Promise.resolve().then(() => registry.complete(providerId, request, { signal: controller.signal }));
        return await Promise.race([operation, timeout]);
      } catch (error) {
        if (error instanceof GatewayError) throw error;
        // Do not forward raw upstream error messages; they may contain private data.
        throw new GatewayError("provider_error", "Model provider request failed");
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
      }
    },
  });
}

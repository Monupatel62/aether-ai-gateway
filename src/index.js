export const GATEWAY_CONTRACT_VERSION = "1.0";
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const MAX_PROVIDER_PRIORITY = 1_000_000;

export function validateModelRequest(input = {}, limits = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("model request must be an object");
  const maxInputBytes = limits.maxInputBytes ?? 1_000_000;
  const maxTimeoutMs = limits.maxTimeoutMs ?? 120_000;
  if (!Number.isInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 10_000_000) throw new TypeError("maxInputBytes is invalid");
  if (!Number.isInteger(maxTimeoutMs) || maxTimeoutMs < 100 || maxTimeoutMs > 600_000) throw new TypeError("maxTimeoutMs is invalid");
  for (const field of ["requestId", "correlationId", "model"]) {
    const value = input[field];
    const pattern = field === "model" ? MODEL_RE : ID_RE;
    if (typeof value !== "string" || !pattern.test(value)) throw new TypeError(`${field} is invalid`);
  }
  if (typeof input.input !== "string" || !input.input.trim()) throw new TypeError("input must be a non-empty string");
  if (Buffer.byteLength(input.input, "utf8") > maxInputBytes) throw new RangeError("model input exceeds configured byte limit");
  const timeoutMs = input.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > maxTimeoutMs) throw new RangeError("timeoutMs is outside allowed bounds");
  const maxOutputTokens = input.maxOutputTokens ?? 1024;
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 32_768) throw new RangeError("maxOutputTokens is outside allowed bounds");
  if (input.stream !== undefined && typeof input.stream !== "boolean") throw new TypeError("stream must be boolean");
  if (input.tenantId !== undefined && (typeof input.tenantId !== "string" || !ID_RE.test(input.tenantId))) throw new TypeError("tenantId is invalid");
  return Object.freeze({
    contractVersion: GATEWAY_CONTRACT_VERSION,
    requestId: input.requestId,
    correlationId: input.correlationId,
    model: input.model,
    input: input.input,
    timeoutMs,
    maxOutputTokens,
    stream: input.stream === true,
    // This is untrusted request metadata only; it must never establish authorization.
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
  });
}

export function selectProvider(capabilities, request) {
  if (!Array.isArray(capabilities)) throw new TypeError("capabilities must be an array");
  if (!request || typeof request.model !== "string" || !MODEL_RE.test(request.model)) throw new TypeError("request model is invalid");
  if (request.stream !== undefined && typeof request.stream !== "boolean") throw new TypeError("request stream flag must be boolean");

  const providerIds = new Set();
  const matches = [];
  for (const item of capabilities) {
    if (!item || typeof item !== "object" || Array.isArray(item) || item.enabled !== true) continue;
    if (typeof item.providerId !== "string" || !ID_RE.test(item.providerId)) continue;
    if (providerIds.has(item.providerId)) continue;
    providerIds.add(item.providerId);
    if (!Array.isArray(item.models) || !item.models.every((model) => typeof model === "string" && MODEL_RE.test(model))) continue;
    const priority = item.priority ?? 100;
    if (!Number.isInteger(priority) || priority < 0 || priority > MAX_PROVIDER_PRIORITY) continue;
    if (!item.models.includes(request.model)) continue;
    if (request.stream === true && item.supportsStreaming !== true) continue;
    matches.push({ providerId: item.providerId, priority });
  }
  if (matches.length === 0) return Object.freeze({ selected: false, reason: "NO_CAPABLE_PROVIDER" });
  matches.sort((a, b) => a.priority - b.priority || a.providerId.localeCompare(b.providerId));
  return Object.freeze({ selected: true, providerId: matches[0].providerId });
}

export function classifyProviderFailure(error = {}) {
  const kind = error && typeof error === "object" ? error.kind : undefined;
  const retryable = kind === "timeout" || kind === "rate_limit" || kind === "unavailable";
  const code = ({
    timeout: "PROVIDER_TIMEOUT",
    rate_limit: "PROVIDER_RATE_LIMITED",
    unavailable: "PROVIDER_UNAVAILABLE",
    invalid_request: "PROVIDER_INVALID_REQUEST",
    authentication: "PROVIDER_AUTH_FAILURE",
    cancelled: "REQUEST_CANCELLED",
  })[kind] ?? "PROVIDER_FAILURE";
  return Object.freeze({ code, retryable, retryAfterMs: retryable && Number.isInteger(error.retryAfterMs) && error.retryAfterMs >= 0 && error.retryAfterMs <= 300_000 ? error.retryAfterMs : undefined });
}

export function getGatewaySafetyPolicy() {
  return Object.freeze({
    providerSecretsServerSideOnly: true,
    treatProviderOutputAsUntrusted: true,
    neverLogRawPromptsByDefault: true,
    enforceRequestTimeouts: true,
    enforceOutputLimits: true,
    cancellationPropagatesToAdapter: true,
  });
}

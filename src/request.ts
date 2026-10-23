export type GatewayMessageRole = "system" | "user" | "assistant";
export interface GatewayMessage {
  readonly role: GatewayMessageRole;
  readonly content: string;
}

export interface GatewayChatRequest {
  readonly schemaVersion: "1";
  readonly model: string;
  readonly messages: readonly GatewayMessage[];
  readonly maxOutputTokens?: number;
  readonly temperature?: number;
  readonly requestId?: string;
}

export interface GatewayRequestLimits {
  readonly maxMessages?: number;
  readonly maxContentChars?: number;
  readonly maxTotalContentChars?: number;
  readonly maxOutputTokens?: number;
  readonly allowSystemMessage?: boolean;
}

export type GatewayRequestIssueCode =
  | "invalid_schema_version"
  | "invalid_model"
  | "invalid_request_id"
  | "empty_messages"
  | "too_many_messages"
  | "invalid_role"
  | "system_message_forbidden"
  | "empty_message"
  | "message_too_large"
  | "total_content_too_large"
  | "invalid_output_tokens"
  | "invalid_temperature"
  | "unknown_field";

export interface GatewayRequestIssue {
  readonly code: GatewayRequestIssueCode;
  readonly path: string;
}

/** Validates a parsed untrusted request. Authorization and model entitlement are separate checks. */
export function validateGatewayRequest(
  value: unknown,
  limits: GatewayRequestLimits = {}
): readonly GatewayRequestIssue[] {
  const issues: GatewayRequestIssue[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [{ code: "invalid_schema_version", path: "/" }];
  }
  const request = value as Record<string, unknown>;
  const allowedKeys = new Set(["schemaVersion", "model", "messages", "maxOutputTokens", "temperature", "requestId"]);
  for (const key of Object.keys(request)) {
    if (!allowedKeys.has(key)) issues.push({ code: "unknown_field", path: `/${key}` });
  }
  if (request.schemaVersion !== "1") issues.push({ code: "invalid_schema_version", path: "/schemaVersion" });
  if (typeof request.model !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(request.model)) {
    issues.push({ code: "invalid_model", path: "/model" });
  }
  if (request.requestId !== undefined &&
      (typeof request.requestId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(request.requestId))) {
    issues.push({ code: "invalid_request_id", path: "/requestId" });
  }

  const messages = request.messages;
  const maxMessages = limits.maxMessages ?? 100;
  const maxContentChars = limits.maxContentChars ?? 32_000;
  const maxTotalContentChars = limits.maxTotalContentChars ?? 200_000;
  if (!Array.isArray(messages) || messages.length === 0) {
    issues.push({ code: "empty_messages", path: "/messages" });
  } else {
    if (messages.length > maxMessages) issues.push({ code: "too_many_messages", path: "/messages" });
    let totalChars = 0;
    messages.forEach((item: unknown, index: number) => {
      const path = `/messages/${index}`;
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        issues.push({ code: "invalid_role", path });
        return;
      }
      const message = item as Record<string, unknown>;
      if (!["system", "user", "assistant"].includes(String(message.role))) {
        issues.push({ code: "invalid_role", path: `${path}/role` });
      } else if (message.role === "system" && limits.allowSystemMessage === false) {
        issues.push({ code: "system_message_forbidden", path: `${path}/role` });
      }
      if (typeof message.content !== "string" || message.content.trim().length === 0) {
        issues.push({ code: "empty_message", path: `${path}/content` });
      } else {
        totalChars += message.content.length;
        if (message.content.length > maxContentChars) issues.push({ code: "message_too_large", path: `${path}/content` });
      }
      for (const key of Object.keys(message)) {
        if (key !== "role" && key !== "content") issues.push({ code: "unknown_field", path: `${path}/${key}` });
      }
    });
    if (totalChars > maxTotalContentChars) issues.push({ code: "total_content_too_large", path: "/messages" });
  }

  if (request.maxOutputTokens !== undefined &&
      (!Number.isInteger(request.maxOutputTokens) || (request.maxOutputTokens as number) < 1 ||
       (request.maxOutputTokens as number) > (limits.maxOutputTokens ?? 32_768))) {
    issues.push({ code: "invalid_output_tokens", path: "/maxOutputTokens" });
  }
  if (request.temperature !== undefined &&
      (typeof request.temperature !== "number" || !Number.isFinite(request.temperature) ||
       request.temperature < 0 || request.temperature > 2)) {
    issues.push({ code: "invalid_temperature", path: "/temperature" });
  }
  return issues;
}

/**
 * Return a shallow typed copy only after validation succeeds. Does not authorize access,
 * validate model entitlements, apply quotas, or prove that message content is trustworthy.
 */
export function parseGatewayRequest(
  value: unknown,
  limits: GatewayRequestLimits = {}
): GatewayChatRequest {
  const issues = validateGatewayRequest(value, limits);
  if (issues.length > 0) throw new TypeError(`Invalid gateway request: ${issues.map(issue => issue.code).join(", ")}`);
  const request = value as GatewayChatRequest;
  return Object.freeze({
    schemaVersion: "1",
    model: request.model,
    messages: Object.freeze(request.messages.map(message => Object.freeze({ role: message.role, content: message.content }))),
    ...(request.maxOutputTokens === undefined ? {} : { maxOutputTokens: request.maxOutputTokens }),
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...(request.requestId === undefined ? {} : { requestId: request.requestId })
  });
}

import { describe, expect, it } from "vitest";
import { parseGatewayRequest, validateGatewayRequest } from "../src/index.js";

const valid = {
  schemaVersion: "1",
  model: "mock/chat-v1",
  messages: [
    { role: "user", content: "Hello synthetic world" },
    { role: "assistant", content: "Hello" }
  ],
  maxOutputTokens: 512,
  temperature: 0.2,
  requestId: "req-123"
};

describe("gateway request validation", () => {
  it("accepts a bounded provider-neutral request and returns a defensive copy", () => {
    const parsed = parseGatewayRequest(valid);
    expect(parsed.model).toBe("mock/chat-v1");
    expect(parsed.messages).toEqual(valid.messages);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.messages)).toBe(true);
  });

  it("rejects unsupported fields and malformed message roles", () => {
    const issues = validateGatewayRequest({
      ...valid,
      apiKey: "must-not-be-accepted",
      messages: [{ role: "tool", content: "bad", toolOutput: "unknown" }]
    });
    expect(issues.map(x => x.code)).toContain("unknown_field");
    expect(issues.map(x => x.code)).toContain("invalid_role");
  });

  it("enforces content, message count, system-message, and output limits", () => {
    const issues = validateGatewayRequest({
      ...valid,
      maxOutputTokens: 9999,
      messages: [{ role: "system", content: "x".repeat(30) }, { role: "user", content: "y" }]
    }, { maxMessages: 1, maxContentChars: 10, maxTotalContentChars: 10, maxOutputTokens: 100, allowSystemMessage: false });
    const codes = issues.map(x => x.code);
    expect(codes).toContain("too_many_messages");
    expect(codes).toContain("message_too_large");
    expect(codes).toContain("system_message_forbidden");
    expect(codes).toContain("total_content_too_large");
    expect(codes).toContain("invalid_output_tokens");
  });

  it("rejects invalid temperature and empty message content", () => {
    const issues = validateGatewayRequest({ ...valid, temperature: 3, messages: [{ role: "user", content: " " }] });
    expect(issues.map(x => x.code)).toContain("invalid_temperature");
    expect(issues.map(x => x.code)).toContain("empty_message");
  });

  it("never implies authorization merely because request validation passed", () => {
    const parsed = parseGatewayRequest(valid);
    expect(parsed.model).toBe("mock/chat-v1");
  });
});

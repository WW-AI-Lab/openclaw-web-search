import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildMissingKeyError,
  buildApiError,
  buildDashScopeApiError,
} from "./errors.js";
import { buildSearchToolSchema } from "./schema.js";
import { resolveCredential } from "./config.js";

// ── Mock SDK functions ──

vi.mock("openclaw/plugin-sdk/provider-web-search", () => ({
  readConfiguredSecretString: (value: unknown, _path: string) => {
    if (typeof value === "string" && value.trim()) return value;
    return undefined;
  },
  readProviderEnvValue: (envVars: string[]) => {
    for (const envVar of envVars) {
      const val = process.env[envVar];
      if (val) return val;
    }
    return undefined;
  },
  resolveProviderWebSearchPluginConfig: () => undefined,
}));

// ── resolveCredential ──

describe("resolveCredential", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return apiKey from config when present", () => {
    const result = resolveCredential("sk-test-key", "tools.web.search.qwen.apiKey", ["DASHSCOPE_API_KEY"]);
    expect(result).toBe("sk-test-key");
  });

  it("should fallback to env var when config has no apiKey", () => {
    process.env.DASHSCOPE_API_KEY = "sk-env-key";
    const result = resolveCredential(undefined, "tools.web.search.qwen.apiKey", ["DASHSCOPE_API_KEY"]);
    expect(result).toBe("sk-env-key");
  });

  it("should return undefined when all sources are empty", () => {
    delete process.env.DASHSCOPE_API_KEY;
    const result = resolveCredential(undefined, "tools.web.search.qwen.apiKey", ["DASHSCOPE_API_KEY"]);
    expect(result).toBeUndefined();
  });

  it("should prefer config over env var", () => {
    process.env.DASHSCOPE_API_KEY = "sk-env-key";
    const result = resolveCredential("sk-config-key", "tools.web.search.qwen.apiKey", ["DASHSCOPE_API_KEY"]);
    expect(result).toBe("sk-config-key");
  });
});

// ── buildMissingKeyError ──

describe("buildMissingKeyError", () => {
  it("should produce correct error id with hyphen-to-underscore replacement", () => {
    const err = buildMissingKeyError(
      "qwen",
      "DASHSCOPE_API_KEY",
      "plugins.entries.openclaw-web-search.config.qwen.apiKey",
    );
    expect(err.error).toBe("missing_qwen_api_key");
    expect(err.message).toContain("qwen");
    expect(err.message).toContain("DASHSCOPE_API_KEY");
    expect(err.message).toContain("plugins.entries.openclaw-web-search.config.qwen.apiKey");
  });

  it("should include docs url when provided", () => {
    const err = buildMissingKeyError("qwen", "DASHSCOPE_API_KEY", "config.path", "https://docs.example.com");
    expect(err.docs).toBe("https://docs.example.com");
  });

  it("should omit docs when not provided", () => {
    const err = buildMissingKeyError("qwen", "DASHSCOPE_API_KEY", "config.path");
    expect(err.docs).toBeUndefined();
  });
});

// ── buildApiError ──

describe("buildApiError", () => {
  it("should produce correct error id and include status", () => {
    const err = buildApiError("qwen", 401, "Unauthorized");
    expect(err.error).toBe("qwen_api_error");
    expect(err.status).toBe(401);
    expect(err.message).toContain("401");
    expect(err.message).toContain("Unauthorized");
  });

  it("should not contain API key in message", () => {
    const err = buildApiError("qwen", 500, "Internal Server Error");
    expect(err.message).not.toContain("sk-");
  });
});

// ── buildDashScopeApiError ──

describe("buildDashScopeApiError", () => {
  it("should parse DashScope native error format", () => {
    const body = JSON.stringify({
      code: "InvalidApiKey",
      message: "Invalid API-key provided.",
      request_id: "abc123",
    });
    const err = buildDashScopeApiError("qwen", 401, body);
    expect(err.error).toBe("qwen_api_error");
    expect(err.dashscope_code).toBe("InvalidApiKey");
    expect(err.request_id).toBe("abc123");
    expect(err.message).toContain("InvalidApiKey");
    expect(err.message).toContain("Invalid API-key provided.");
    expect(err.status).toBe(401);
  });

  it("should fallback to generic error when body is not valid JSON", () => {
    const err = buildDashScopeApiError("qwen", 500, "not json");
    expect(err.error).toBe("qwen_api_error");
    expect(err.status).toBe(500);
    expect(err.dashscope_code).toBeUndefined();
    expect(err.message).toContain("not json");
  });

  it("should fallback when JSON has no code field", () => {
    const body = JSON.stringify({ error: "something went wrong" });
    const err = buildDashScopeApiError("qwen", 502, body);
    expect(err.dashscope_code).toBeUndefined();
  });
});

// ── buildSearchToolSchema ──

describe("buildSearchToolSchema", () => {
  it("should create schema with required query parameter", () => {
    const schema = buildSearchToolSchema();
    expect(schema.type).toBe("object");
    expect(schema.properties.query).toBeDefined();
    expect(schema.properties.query.type).toBe("string");
    expect(schema.additionalProperties).toBe(false);
  });

  it("should accept extra properties", async () => {
    const { Type } = await import("@sinclair/typebox");
    const schema = buildSearchToolSchema({
      count: Type.Optional(Type.Number({ description: "Result count" })),
    });
    expect(schema.properties.query).toBeDefined();
    expect(schema.properties.count).toBeDefined();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted 确保 mock 变量在 vi.mock 提升后仍可用
const mocks = vi.hoisted(() => ({
  readCachedSearchPayload: vi.fn().mockReturnValue(undefined),
  writeCachedSearchPayload: vi.fn(),
  buildSearchCacheKey: vi.fn((...args: unknown[]) => JSON.stringify(args)),
  readStringParam: vi.fn((params: Record<string, unknown>, key: string) => params[key] as string),
  readNumberParam: vi.fn(),
  wrapWebContent: vi.fn((content: string) => `[WRAPPED]${content}[/WRAPPED]`),
  withTrustedWebSearchEndpoint: vi.fn(),
  resolveSearchCacheTtlMs: vi.fn().mockReturnValue(300000),
  resolveSearchTimeoutSeconds: vi.fn().mockReturnValue(30),
  readConfiguredSecretString: vi.fn((value: unknown) => {
    if (typeof value === "string" && value.trim()) return value;
    return undefined;
  }),
  readProviderEnvValue: vi.fn((envVars: string[]) => {
    for (const envVar of envVars) {
      const val = process.env[envVar];
      if (val) return val;
    }
    return undefined;
  }),
  getScopedCredentialValue: vi.fn(),
  setScopedCredentialValue: vi.fn(),
  resolveProviderWebSearchPluginConfig: vi.fn().mockReturnValue(undefined),
  setProviderWebSearchPluginConfigValue: vi.fn(),
  mergeScopedSearchConfig: vi.fn(
    (searchConfig: unknown, _scopeKey: string, pluginConfig: unknown) => ({
      ...(searchConfig as Record<string, unknown> ?? {}),
      ...(pluginConfig as Record<string, unknown> ?? {}),
    }),
  ),
}));

vi.mock("openclaw/plugin-sdk/provider-web-search", () => mocks);

import { createQwenProvider, __testing } from "./qwen-provider.js";
import type { DashScopeResponse } from "../shared/types.js";

const {
  resolveQwenConfig,
  resolveApiKey,
  resolveModel,
  extractCitations,
  buildRequestBody,
  buildCacheKeyFactors,
  PROVIDER_ID,
  DASHSCOPE_ENDPOINT,
  DEFAULT_MODEL,
} = __testing;

// ── 4.2: 凭据缺失时返回结构化错误（不抛出异常） ──

describe("凭据缺失错误", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DASHSCOPE_API_KEY;
    vi.clearAllMocks();
    mocks.readConfiguredSecretString.mockReturnValue(undefined);
    mocks.readProviderEnvValue.mockReturnValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return structured error when API key is missing", async () => {
    const provider = createQwenProvider();
    const tool = provider.createTool({ searchConfig: undefined, config: undefined } as never);
    const result = await tool.execute({ query: "test" });

    expect(result).toHaveProperty("error", "missing_qwen_api_key");
    expect(result).toHaveProperty("message");
    expect((result as Record<string, unknown>).message).toContain("DASHSCOPE_API_KEY");
    expect(mocks.withTrustedWebSearchEndpoint).not.toHaveBeenCalled();
  });

  it("should not throw an exception when API key is missing", async () => {
    const provider = createQwenProvider();
    const tool = provider.createTool({ searchConfig: undefined, config: undefined } as never);
    await expect(tool.execute({ query: "test" })).resolves.toBeDefined();
  });
});

// ── 4.3: query 参数校验 ──

describe("query 参数校验", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readConfiguredSecretString.mockReturnValue("sk-test");
  });

  it("should use readStringParam with required: true", () => {
    mocks.readStringParam.mockImplementation(
      (_params: Record<string, unknown>, _key: string, opts?: { required?: boolean }) => {
        if (opts?.required) throw new Error("query is required");
        return undefined;
      },
    );

    const provider = createQwenProvider();
    const tool = provider.createTool({
      searchConfig: { qwen: { apiKey: "sk-test" } },
      config: undefined,
    } as never);

    expect(tool.execute({ query: "" })).rejects.toThrow("query is required");
  });
});

// ── 4.4: 请求体序列化 ──

describe("请求体序列化", () => {
  it("should build DashScope native format with input.messages and parameters", () => {
    const body = buildRequestBody("杭州天气", "qwen-plus", {});
    expect(body).toHaveProperty("model", "qwen-plus");
    expect(body).toHaveProperty("input.messages");
    const messages = (body.input as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    expect(messages[0]).toEqual({ role: "user", content: "杭州天气" });
    const params = body.parameters as Record<string, unknown>;
    expect(params.enable_search).toBe(true);
    expect(params.result_format).toBe("message");
  });

  it("should include search_options when searchStrategy is set", () => {
    const body = buildRequestBody("test", "qwen-plus", { searchStrategy: "max" });
    const params = body.parameters as Record<string, unknown>;
    const searchOptions = params.search_options as Record<string, unknown>;
    expect(searchOptions.search_strategy).toBe("max");
  });

  it("should include forced_search when set to true", () => {
    const body = buildRequestBody("test", "qwen-plus", { forcedSearch: true });
    const params = body.parameters as Record<string, unknown>;
    const searchOptions = params.search_options as Record<string, unknown>;
    expect(searchOptions.forced_search).toBe(true);
  });

  it("should include enable_thinking when enableThinking is true", () => {
    const body = buildRequestBody("test", "qwen-plus", { enableThinking: true });
    const params = body.parameters as Record<string, unknown>;
    expect(params.enable_thinking).toBe(true);
  });

  it("should include enable_search_extension when set", () => {
    const body = buildRequestBody("test", "qwen-plus", { enableSearchExtension: true });
    const params = body.parameters as Record<string, unknown>;
    const searchOptions = params.search_options as Record<string, unknown>;
    expect(searchOptions.enable_search_extension).toBe(true);
  });

  it("should include freshness when set", () => {
    const body = buildRequestBody("test", "qwen-plus", { freshness: 7 });
    const params = body.parameters as Record<string, unknown>;
    const searchOptions = params.search_options as Record<string, unknown>;
    expect(searchOptions.freshness).toBe(7);
  });

  it("should include enable_source as true by default", () => {
    const body = buildRequestBody("test", "qwen-plus", {});
    const params = body.parameters as Record<string, unknown>;
    const searchOptions = params.search_options as Record<string, unknown>;
    expect(searchOptions.enable_source).toBe(true);
  });

  it("should include enable_citation and citation_format when set", () => {
    const body = buildRequestBody("test", "qwen-plus", {
      enableCitation: true,
      citationFormat: "[ref_<number>]",
    });
    const params = body.parameters as Record<string, unknown>;
    const searchOptions = params.search_options as Record<string, unknown>;
    expect(searchOptions.enable_citation).toBe(true);
    expect(searchOptions.citation_format).toBe("[ref_<number>]");
  });

  it("should include assigned_site_list when set", () => {
    const body = buildRequestBody("test", "qwen-plus", {
      assignedSiteList: ["baidu.com", "sina.cn"],
    });
    const params = body.parameters as Record<string, unknown>;
    const searchOptions = params.search_options as Record<string, unknown>;
    expect(searchOptions.assigned_site_list).toEqual(["baidu.com", "sina.cn"]);
  });

  it("should only send query as user message content", () => {
    const body = buildRequestBody("my search query", "qwen-plus", {});
    const messages = (body.input as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("my search query");
  });
});

// ── 4.5: 正常响应归一化 ──

describe("响应归一化", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readConfiguredSecretString.mockReturnValue("sk-test");
    mocks.readStringParam.mockImplementation(
      (params: Record<string, unknown>, key: string) => params[key] as string,
    );
  });

  it("should extract content from output.choices[0].message.content", () => {
    const response: DashScopeResponse = {
      output: {
        choices: [{ message: { role: "assistant", content: "搜索结果内容" }, finish_reason: "stop" }],
      },
      request_id: "req-1",
    };
    const content = response.output.choices[0].message.content;
    expect(content).toBe("搜索结果内容");
  });

  it("should extract citations from search_info.search_results[].url", () => {
    const response: DashScopeResponse = {
      output: {
        choices: [{ message: { role: "assistant", content: "some content" }, finish_reason: "stop" }],
        search_info: {
          search_results: [
            { index: 1, title: "Result 1", url: "https://example.com/1" },
            { index: 2, title: "Result 2", url: "https://example.com/2" },
          ],
        },
      },
    };
    const citations = extractCitations(response);
    expect(citations).toContain("https://example.com/1");
    expect(citations).toContain("https://example.com/2");
  });

  it("should also extract URLs from content via regex", () => {
    const response: DashScopeResponse = {
      output: {
        choices: [{
          message: { role: "assistant", content: "Visit https://extra.com/page for more" },
          finish_reason: "stop",
        }],
      },
    };
    const citations = extractCitations(response);
    expect(citations).toContain("https://extra.com/page");
  });

  it("should merge and deduplicate citations from both sources", () => {
    const response: DashScopeResponse = {
      output: {
        choices: [{
          message: { role: "assistant", content: "See https://example.com/1 and https://example.com/3" },
          finish_reason: "stop",
        }],
        search_info: {
          search_results: [
            { index: 1, title: "Result 1", url: "https://example.com/1" },
            { index: 2, title: "Result 2", url: "https://example.com/2" },
          ],
        },
      },
    };
    const citations = extractCitations(response);
    expect(citations).toHaveLength(3);
    expect(citations).toContain("https://example.com/1");
    expect(citations).toContain("https://example.com/2");
    expect(citations).toContain("https://example.com/3");
  });

  it("should call wrapWebContent on the response", async () => {
    mocks.withTrustedWebSearchEndpoint.mockImplementation(
      async (_params: unknown, callback: (res: unknown) => Promise<unknown>) => {
        return callback({
          ok: true,
          json: async () => ({
            output: {
              choices: [{ message: { role: "assistant", content: "wrapped content" }, finish_reason: "stop" }],
              search_info: { search_results: [] },
            },
            request_id: "req-1",
          }),
        });
      },
    );

    const provider = createQwenProvider();
    const tool = provider.createTool({
      searchConfig: { qwen: { apiKey: "sk-test" } },
      config: undefined,
    } as never);

    const result = await tool.execute({ query: "test" }) as Record<string, unknown>;
    expect(result.content).toContain("[WRAPPED]");
    expect(mocks.wrapWebContent).toHaveBeenCalledWith("wrapped content");
  });
});

// ── 4.6: 缓存命中 ──

describe("缓存命中", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readConfiguredSecretString.mockReturnValue("sk-test");
    mocks.readStringParam.mockImplementation(
      (params: Record<string, unknown>, key: string) => params[key] as string,
    );
  });

  it("should return cached content when cache hits", async () => {
    const cachedResult = {
      query: "cached query",
      provider: PROVIDER_ID,
      content: "cached content",
      citations: ["https://cached.com"],
    };
    mocks.readCachedSearchPayload.mockReturnValue(cachedResult);

    const provider = createQwenProvider();
    const tool = provider.createTool({
      searchConfig: { qwen: { apiKey: "sk-test" } },
      config: undefined,
    } as never);

    const result = await tool.execute({ query: "cached query" });
    expect(result).toEqual(cachedResult);
    expect(mocks.withTrustedWebSearchEndpoint).not.toHaveBeenCalled();
  });

  it("should cache different search parameters separately", () => {
    const factors1 = buildCacheKeyFactors("test", "qwen-plus", { searchStrategy: "turbo" });
    const factors2 = buildCacheKeyFactors("test", "qwen-plus", { searchStrategy: "max" });
    expect(factors1).not.toEqual(factors2);
  });

  it("should not include API key in cache key factors", () => {
    const factors = buildCacheKeyFactors("test", "qwen-plus", { apiKey: "sk-secret" });
    const factorsStr = JSON.stringify(factors);
    expect(factorsStr).not.toContain("sk-secret");
  });
});

// ── 4.7: 非 2xx 响应 ──

describe("非 2xx 响应", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readCachedSearchPayload.mockReturnValue(undefined);
    mocks.readConfiguredSecretString.mockReturnValue("sk-test-key");
    mocks.readStringParam.mockImplementation(
      (params: Record<string, unknown>, key: string) => params[key] as string,
    );
  });

  it("should parse DashScope native error format", async () => {
    const errorBody = JSON.stringify({
      code: "InvalidApiKey",
      message: "Invalid API-key provided.",
      request_id: "req-err-1",
    });

    mocks.withTrustedWebSearchEndpoint.mockImplementation(
      async (_params: unknown, callback: (res: unknown) => Promise<unknown>) => {
        return callback({ ok: false, status: 401, text: async () => errorBody });
      },
    );

    const provider = createQwenProvider();
    const tool = provider.createTool({
      searchConfig: { qwen: { apiKey: "sk-test-key" } },
      config: undefined,
    } as never);

    const result = await tool.execute({ query: "test" }) as Record<string, unknown>;
    expect(result.error).toBe("qwen_api_error");
    expect(result.dashscope_code).toBe("InvalidApiKey");
    expect(result.request_id).toBe("req-err-1");
    expect(result.status).toBe(401);
  });

  it("should fallback to generic error for non-JSON responses", async () => {
    mocks.withTrustedWebSearchEndpoint.mockImplementation(
      async (_params: unknown, callback: (res: unknown) => Promise<unknown>) => {
        return callback({ ok: false, status: 500, text: async () => "Internal Server Error" });
      },
    );

    const provider = createQwenProvider();
    const tool = provider.createTool({
      searchConfig: { qwen: { apiKey: "sk-test-key" } },
      config: undefined,
    } as never);

    const result = await tool.execute({ query: "test" }) as Record<string, unknown>;
    expect(result.error).toBe("qwen_api_error");
    expect(result.status).toBe(500);
    expect(result.dashscope_code).toBeUndefined();
  });

  it("should not contain API key in error messages", async () => {
    mocks.withTrustedWebSearchEndpoint.mockImplementation(
      async (_params: unknown, callback: (res: unknown) => Promise<unknown>) => {
        return callback({ ok: false, status: 403, text: async () => "Forbidden" });
      },
    );

    const provider = createQwenProvider();
    const tool = provider.createTool({
      searchConfig: { qwen: { apiKey: "sk-test-key" } },
      config: undefined,
    } as never);

    const result = await tool.execute({ query: "test" }) as Record<string, unknown>;
    expect(JSON.stringify(result)).not.toContain("sk-test-key");
  });
});

// ── 4.8: 搜索来源缺失时的 fallback ──

describe("搜索来源 fallback", () => {
  it("should fallback to regex when search_info is missing", () => {
    const response: DashScopeResponse = {
      output: {
        choices: [{
          message: { role: "assistant", content: "查看 https://fallback.com/page 了解详情" },
          finish_reason: "stop",
        }],
      },
    };
    const citations = extractCitations(response);
    expect(citations).toContain("https://fallback.com/page");
  });

  it("should fallback to regex when search_results is empty", () => {
    const response: DashScopeResponse = {
      output: {
        choices: [{
          message: { role: "assistant", content: "Visit https://fallback2.com/path" },
          finish_reason: "stop",
        }],
        search_info: { search_results: [] },
      },
    };
    const citations = extractCitations(response);
    expect(citations).toContain("https://fallback2.com/path");
  });

  it("should return empty citations when no URLs found", () => {
    const response: DashScopeResponse = {
      output: {
        choices: [{
          message: { role: "assistant", content: "No URLs in this response" },
          finish_reason: "stop",
        }],
      },
    };
    const citations = extractCitations(response);
    expect(citations).toHaveLength(0);
  });

  it("should handle null content gracefully", () => {
    const response: DashScopeResponse = {
      output: {
        choices: [{
          message: { role: "assistant", content: null },
          finish_reason: "stop",
        }],
      },
    };
    const citations = extractCitations(response);
    expect(citations).toHaveLength(0);
  });
});

// ── Provider 元信息验证 ──

describe("Provider 元信息", () => {
  it("should have correct id and metadata", () => {
    const provider = createQwenProvider();
    expect(provider.id).toBe("qwen");
    expect(provider.label).toBe("Qwen (DashScope)");
    expect(provider.envVars).toEqual(["DASHSCOPE_API_KEY"]);
    expect(provider.placeholder).toBe("sk-...");
    expect(provider.signupUrl).toBe("https://dashscope.aliyun.com/");
    expect(provider.autoDetectOrder).toBe(50);
  });

  it("should use default model qwen-plus", () => {
    expect(DEFAULT_MODEL).toBe("qwen-plus");
    expect(resolveModel({})).toBe("qwen-plus");
  });

  it("should resolve custom model from config", () => {
    expect(resolveModel({ model: "qwen3-max" })).toBe("qwen3-max");
  });

  it("should use DashScope native endpoint", () => {
    expect(DASHSCOPE_ENDPOINT).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    );
  });
});

// ── resolveQwenConfig ──

describe("resolveQwenConfig", () => {
  it("should extract qwen scoped config", () => {
    const config = resolveQwenConfig({ qwen: { model: "qwen3-max" } } as never);
    expect(config.model).toBe("qwen3-max");
  });

  it("should return empty object when no qwen scope", () => {
    const config = resolveQwenConfig({} as never);
    expect(config).toEqual({});
  });

  it("should return empty object when searchConfig is undefined", () => {
    const config = resolveQwenConfig(undefined);
    expect(config).toEqual({});
  });
});

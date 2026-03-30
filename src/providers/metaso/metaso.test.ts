import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildSearchCacheKey: vi.fn((factors: unknown[]) => JSON.stringify(factors)),
  getScopedCredentialValue: vi.fn(),
  mergeScopedSearchConfig: vi.fn(
    (searchConfig: Record<string, unknown> | undefined, scopeKey: string, pluginConfig: unknown) => ({
      ...(searchConfig ?? {}),
      [scopeKey]: {
        ...((searchConfig?.[scopeKey] as Record<string, unknown> | undefined) ?? {}),
        ...((pluginConfig as Record<string, unknown> | undefined) ?? {}),
      },
    }),
  ),
  readCachedSearchPayload: vi.fn().mockReturnValue(undefined),
  readConfiguredSecretString: vi.fn((value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    return undefined;
  }),
  readProviderEnvValue: vi.fn((envVars: string[]) => {
    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        return value;
      }
    }
    return undefined;
  }),
  readStringParam: vi.fn((params: Record<string, unknown>, key: string) => {
    const value = params[key];
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${key} is required`);
  }),
  resolveProviderWebSearchPluginConfig: vi.fn().mockReturnValue(undefined),
  resolveSearchCacheTtlMs: vi.fn().mockReturnValue(300000),
  resolveSearchTimeoutSeconds: vi.fn().mockReturnValue(30),
  setProviderWebSearchPluginConfigValue: vi.fn(),
  setScopedCredentialValue: vi.fn(),
  withTrustedWebSearchEndpoint: vi.fn(),
  wrapWebContent: vi.fn((content: string) => `[WRAPPED]${content}[/WRAPPED]`),
  writeCachedSearchPayload: vi.fn(),
}));

vi.mock("openclaw/plugin-sdk/provider-web-search", () => mocks);

import { createMetasoProvider, __testing } from "./metaso-provider.js";

function restoreProviderWebSearchMocks(): void {
  mocks.buildSearchCacheKey.mockImplementation((factors: unknown[]) => JSON.stringify(factors));
  mocks.mergeScopedSearchConfig.mockImplementation(
    (searchConfig: Record<string, unknown> | undefined, scopeKey: string, pluginConfig: unknown) => ({
      ...(searchConfig ?? {}),
      [scopeKey]: {
        ...((searchConfig?.[scopeKey] as Record<string, unknown> | undefined) ?? {}),
        ...((pluginConfig as Record<string, unknown> | undefined) ?? {}),
      },
    }),
  );
  mocks.readCachedSearchPayload.mockReturnValue(undefined);
  mocks.readConfiguredSecretString.mockImplementation((value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    return undefined;
  });
  mocks.readProviderEnvValue.mockImplementation((envVars: string[]) => {
    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        return value;
      }
    }
    return undefined;
  });
  mocks.readStringParam.mockImplementation((params: Record<string, unknown>, key: string) => {
    const value = params[key];
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${key} is required`);
  });
  mocks.resolveProviderWebSearchPluginConfig.mockReturnValue(undefined);
  mocks.resolveSearchCacheTtlMs.mockReturnValue(300000);
  mocks.resolveSearchTimeoutSeconds.mockReturnValue(30);
  mocks.wrapWebContent.mockImplementation((content: string) => `[WRAPPED]${content}[/WRAPPED]`);
}

const {
  resolveMetasoConfig,
  resolveApiKey,
  resolveMode,
  resolveSearchOptions,
  resolveResearchModel,
  normalizeSearchItems,
  formatSearchContent,
  extractSearchCitations,
  parseResearchPayload,
  buildCacheKeyFactors,
  PROVIDER_ID,
  SEARCH_ENDPOINT,
  READER_ENDPOINT,
  RESEARCH_ENDPOINT,
  DEFAULT_MODE,
  DEFAULT_RESEARCH_MODEL,
  CACHE_FORMAT_VERSION,
} = __testing;

describe("Metaso provider 凭据缺失", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.METASO_API_KEY;
    vi.resetAllMocks();
    restoreProviderWebSearchMocks();
    mocks.readConfiguredSecretString.mockReturnValue(undefined);
    mocks.readProviderEnvValue.mockReturnValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return structured error when API key is missing", async () => {
    const provider = createMetasoProvider();
    const tool = provider.createTool({ searchConfig: undefined, config: undefined } as never);

    const result = await tool.execute({ query: "杭州天气" }) as Record<string, unknown>;

    expect(result.error).toBe("missing_metaso_api_key");
    expect(result.message).toContain("METASO_API_KEY");
    expect(mocks.withTrustedWebSearchEndpoint).not.toHaveBeenCalled();
  });
});

describe("Metaso provider 参数与序列化", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreProviderWebSearchMocks();
    mocks.readConfiguredSecretString.mockReturnValue("mk-test");
  });

  it("should use search as default mode", () => {
    expect(DEFAULT_MODE).toBe("search");
    expect(resolveMode({}, {})).toBe("search");
  });

  it("should resolve search options from args and config", () => {
    expect(
      resolveSearchOptions(
        { size: 20, includeSummary: false },
        { scope: "news", conciseSnippet: true },
      ),
    ).toEqual({
      scope: "news",
      size: 10,
      includeSummary: false,
      includeRawContent: false,
      conciseSnippet: true,
    });
  });

  it("should resolve deep research model with default fallback", () => {
    expect(DEFAULT_RESEARCH_MODEL).toBe("fast_thinking");
    expect(resolveResearchModel({}, {})).toBe("fast_thinking");
    expect(resolveResearchModel({ model: "ds-r1" }, {})).toBe("ds-r1");
  });

  it("should serialize search request body correctly", async () => {
    mocks.withTrustedWebSearchEndpoint.mockImplementation(
      async (request: Record<string, unknown>, callback: (res: unknown) => Promise<unknown>) => {
        expect(request.url).toBe(SEARCH_ENDPOINT);
        const init = request.init as Record<string, unknown>;
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        expect(body).toEqual({
          q: "杭州天气",
          scope: "webpage",
          includeSummary: true,
          size: "3",
          includeRawContent: true,
          conciseSnippet: false,
        });

        return callback({
          ok: true,
          json: async () => ({
            summary: "摘要",
            results: [{ title: "示例", url: "https://example.com", summary: "结果摘要" }],
          }),
        });
      },
    );

    const provider = createMetasoProvider();
    const tool = provider.createTool({
      searchConfig: { metaso: { apiKey: "mk-test" } },
      config: undefined,
    } as never);

    const result = await tool.execute({
      query: "杭州天气",
      size: 3,
      includeRawContent: true,
    }) as Record<string, unknown>;

    expect(result.provider).toBe(PROVIDER_ID);
    expect(String(result.content)).toContain("[WRAPPED]");
  });

  it("should serialize reader request body correctly", async () => {
    mocks.withTrustedWebSearchEndpoint.mockImplementation(
      async (request: Record<string, unknown>, callback: (res: unknown) => Promise<unknown>) => {
        expect(request.url).toBe(READER_ENDPOINT);
        const init = request.init as Record<string, unknown>;
        expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.com/article" });
        return callback({ ok: true, text: async () => "页面正文 https://example.com/article" });
      },
    );

    const provider = createMetasoProvider();
    const tool = provider.createTool({
      searchConfig: { metaso: { apiKey: "mk-test" } },
      config: undefined,
    } as never);

    const result = await tool.execute({ mode: "reader", url: "https://example.com/article" }) as Record<string, unknown>;
    expect(result.citations).toEqual(["https://example.com/article"]);
  });

  it("should serialize deep research request body correctly", async () => {
    mocks.withTrustedWebSearchEndpoint.mockImplementation(
      async (request: Record<string, unknown>, callback: (res: unknown) => Promise<unknown>) => {
        expect(request.url).toBe(RESEARCH_ENDPOINT);
        const init = request.init as Record<string, unknown>;
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        expect(body).toEqual({
          model: "ds-r1",
          stream: true,
          messages: [{ role: "user", content: "研究 Agent 设计" }],
        });
        return callback({
          ok: true,
          text: async () => [
            'data: {"choices":[{"delta":{"content":"第一段"}}]}',
            '',
            'data: {"choices":[{"delta":{"content":"第二段 https://source.example.com"}}],"citations":["https://source.example.com"]}',
            '',
            'data: [DONE]',
          ].join("\n"),
        });
      },
    );

    const provider = createMetasoProvider();
    const tool = provider.createTool({
      searchConfig: { metaso: { apiKey: "mk-test" } },
      config: undefined,
    } as never);

    const result = await tool.execute({ mode: "deep_research", query: "研究 Agent 设计", model: "ds-r1" }) as Record<string, unknown>;
    expect(String(result.content)).toContain("第一段第二段");
    expect(result.citations).toContain("https://source.example.com");
  });
});

describe("Metaso provider 响应归一化", () => {
  it("should normalize search items and citations", () => {
    const data = {
      summary: "统一摘要",
      results: [
        { title: "结果一", url: "https://a.example.com", summary: "A" },
        { title: "结果二", link: "https://b.example.com", snippet: "B" },
      ],
    };

    expect(normalizeSearchItems(data)).toEqual([
      { title: "结果一", url: "https://a.example.com", summary: "A" },
      { title: "结果二", url: "https://b.example.com", summary: "B" },
    ]);
    expect(formatSearchContent(data)).toContain("统一摘要");
    expect(extractSearchCitations(data, "额外链接 https://c.example.com")).toEqual([
      "https://a.example.com",
      "https://b.example.com",
      "https://c.example.com",
    ]);
  });

  it("should normalize Metaso webpages search shape", () => {
    const data = {
      credits: 3,
      webpages: [
        {
          title: "秘塔 AI 搜索 API",
          link: "https://metaso.cn/search-api/playground",
          snippet: "官方 playground 与接口说明。",
          position: 1,
        },
      ],
    };

    expect(normalizeSearchItems(data)).toEqual([
      {
        title: "秘塔 AI 搜索 API",
        url: "https://metaso.cn/search-api/playground",
        summary: "官方 playground 与接口说明。",
      },
    ]);
    expect(formatSearchContent(data)).toContain("秘塔 AI 搜索 API");
    expect(extractSearchCitations(data, String(formatSearchContent(data)))).toEqual([
      "https://metaso.cn/search-api/playground",
    ]);
  });

  it("should include cache format version in cache key factors", () => {
    expect(buildCacheKeyFactors("search", "秘塔API功能介绍", ["webpage", 10])).toEqual([
      PROVIDER_ID,
      CACHE_FORMAT_VERSION,
      "search",
      "秘塔API功能介绍",
      "webpage",
      10,
    ]);
  });

  it("should parse SSE payloads into combined deep research content", () => {
    const parsed = parseResearchPayload([
      'data: {"choices":[{"delta":{"content":"foo"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"bar https://d.example.com"}}],"references":[{"url":"https://d.example.com"}]}',
      '',
      'data: [DONE]',
    ].join("\n"));

    expect(parsed.content).toBe("foobar https://d.example.com");
    expect(parsed.citations).toEqual(["https://d.example.com"]);
  });
});

describe("Metaso provider 缓存与错误处理", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreProviderWebSearchMocks();
    mocks.readConfiguredSecretString.mockReturnValue("mk-test");
  });

  it("should return cached content when cache hits", async () => {
    const cachedResult = {
      query: "缓存结果",
      provider: PROVIDER_ID,
      content: "cached",
      citations: ["https://cached.example.com"],
    };
    mocks.readCachedSearchPayload.mockReturnValue(cachedResult);

    const provider = createMetasoProvider();
    const tool = provider.createTool({ searchConfig: { metaso: { apiKey: "mk-test" } }, config: undefined } as never);
    const result = await tool.execute({ query: "缓存结果" });

    expect(result).toEqual(cachedResult);
    expect(mocks.withTrustedWebSearchEndpoint).not.toHaveBeenCalled();
  });

  it("should build different cache key factors across modes", () => {
    expect(buildCacheKeyFactors("search", "杭州天气", ["webpage", 10])).not.toEqual(
      buildCacheKeyFactors("deep_research", "杭州天气", ["fast"]),
    );
  });

  it("should return structured provider error on non-2xx response", async () => {
    mocks.withTrustedWebSearchEndpoint.mockImplementation(
      async (_request: unknown, callback: (res: unknown) => Promise<unknown>) =>
        callback({
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ code: "rate_limited", message: "too many requests", request_id: "req-1" }),
        }),
    );

    const provider = createMetasoProvider();
    const tool = provider.createTool({ searchConfig: { metaso: { apiKey: "mk-test" } }, config: undefined } as never);
    const result = await tool.execute({ query: "限流测试" }) as Record<string, unknown>;

    expect(result.error).toBe("metaso_search_api_error");
    expect(result.provider_code).toBe("rate_limited");
    expect(result.request_id).toBe("req-1");
    expect(result.status).toBe(429);
  });
});

describe("Metaso provider 元信息", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreProviderWebSearchMocks();
  });

  it("should expose correct metadata", () => {
    const provider = createMetasoProvider();

    expect(provider.id).toBe("metaso");
    expect(provider.label).toBe("Metaso");
    expect(provider.envVars).toEqual(["METASO_API_KEY"]);
    expect(provider.credentialPath).toBe("plugins.entries.openclaw-web-search.config.metaso.apiKey");
    expect(provider.docsUrl).toBe("https://metaso.cn/search-api/playground");
  });

  it("should resolve scoped config and api key", () => {
    expect(resolveMetasoConfig({ metaso: { mode: "reader" } } as never)).toEqual({ mode: "reader" });
    expect(resolveApiKey({ apiKey: "mk-inline" })).toBe("mk-inline");
  });
});
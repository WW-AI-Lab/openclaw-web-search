import {
  buildSearchCacheKey,
  getScopedCredentialValue,
  mergeScopedSearchConfig,
  readCachedSearchPayload,
  readStringParam,
  resolveProviderWebSearchPluginConfig,
  resolveSearchCacheTtlMs,
  resolveSearchTimeoutSeconds,
  setProviderWebSearchPluginConfigValue,
  setScopedCredentialValue,
  withTrustedWebSearchEndpoint,
  wrapWebContent,
  writeCachedSearchPayload,
  type SearchConfigRecord,
  type WebSearchProviderPlugin,
  type WebSearchProviderToolDefinition,
} from "openclaw/plugin-sdk/provider-web-search";

import {
  resolveCredential,
  buildMissingKeyError,
  buildDashScopeApiError,
  buildSearchToolSchema,
  type DashScopeResponse,
  type SearchToolResult,
  type ProviderConfig,
} from "../shared/index.js";

// ── 常量 ──

const PROVIDER_ID = "qwen-dashscope";
const PLUGIN_ID = "openclaw-web-search";
const SCOPE_KEY = "qwen";
const ENV_VARS = ["DASHSCOPE_API_KEY"];
const SECRET_PATH = "tools.web.search.qwen.apiKey";
const CREDENTIAL_PATH = `plugins.entries.${PLUGIN_ID}.config.qwen.apiKey`;
const DASHSCOPE_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";
const DEFAULT_MODEL = "qwen-plus";
const DEFAULT_TIMEOUT_SECONDS = 30;

// ── 通义百炼 Provider 配置类型 ──

type QwenProviderConfig = ProviderConfig & {
  model?: string;
  searchStrategy?: string;
  forcedSearch?: boolean;
  enableThinking?: boolean;
  enableSearchExtension?: boolean;
  enableSource?: boolean;
  enableCitation?: boolean;
  citationFormat?: string;
  freshness?: number;
  assignedSiteList?: string[];
  intentionOptions?: { prompt_intervene?: string };
};

// ── 配置解析辅助 ──

function resolveQwenConfig(searchConfig?: SearchConfigRecord): QwenProviderConfig {
  const scoped = searchConfig?.[SCOPE_KEY];
  return scoped && typeof scoped === "object" && !Array.isArray(scoped)
    ? (scoped as QwenProviderConfig)
    : {};
}

function resolveApiKey(config: QwenProviderConfig): string | undefined {
  return resolveCredential(config.apiKey, SECRET_PATH, ENV_VARS);
}

function resolveModel(config: QwenProviderConfig): string {
  return typeof config.model === "string" && config.model.trim()
    ? config.model.trim()
    : DEFAULT_MODEL;
}

function resolveTimeoutSeconds(
  config: QwenProviderConfig,
  searchConfig?: SearchConfigRecord,
): number {
  if (typeof config.timeoutSeconds === "number" && Number.isFinite(config.timeoutSeconds)) {
    return config.timeoutSeconds;
  }
  return searchConfig
    ? resolveSearchTimeoutSeconds(searchConfig)
    : DEFAULT_TIMEOUT_SECONDS;
}

// ── Citations 提取 ──

function extractCitations(data: DashScopeResponse): string[] {
  const urls = new Set<string>();

  const searchResults = data.output?.search_info?.search_results;
  if (searchResults?.length) {
    for (const result of searchResults) {
      if (result.url) urls.add(result.url);
    }
  }

  const content = data.output?.choices?.[0]?.message?.content;
  if (content) {
    const urlPattern = /https?:\/\/[^\s)<>\]"']+/g;
    for (const match of content.matchAll(urlPattern)) {
      urls.add(match[0]);
    }
  }

  return [...urls];
}

// ── 搜索请求构建 ──

function buildRequestBody(
  query: string,
  model: string,
  config: QwenProviderConfig,
): Record<string, unknown> {
  const searchOptions: Record<string, unknown> = {};

  if (config.searchStrategy) {
    searchOptions.search_strategy = config.searchStrategy;
  }
  if (config.forcedSearch === true) {
    searchOptions.forced_search = true;
  }
  if (config.enableSearchExtension === true) {
    searchOptions.enable_search_extension = true;
  }
  if (typeof config.freshness === "number") {
    searchOptions.freshness = config.freshness;
  }
  if (config.enableSource !== false) {
    searchOptions.enable_source = config.enableSource ?? true;
  }
  if (config.enableCitation === true) {
    searchOptions.enable_citation = true;
    if (config.citationFormat) {
      searchOptions.citation_format = config.citationFormat;
    }
  }
  if (config.assignedSiteList?.length) {
    searchOptions.assigned_site_list = config.assignedSiteList;
  }
  if (config.intentionOptions?.prompt_intervene) {
    searchOptions.intention_options = {
      prompt_intervene: config.intentionOptions.prompt_intervene,
    };
  }

  const parameters: Record<string, unknown> = {
    enable_search: true,
    result_format: "message",
  };

  if (Object.keys(searchOptions).length > 0) {
    parameters.search_options = searchOptions;
  }

  if (config.enableThinking === true) {
    parameters.enable_thinking = true;
  }

  return {
    model,
    input: {
      messages: [{ role: "user", content: query }],
    },
    parameters,
  };
}

// ── 缓存 key 构建 ──

function buildCacheKeyFactors(
  query: string,
  model: string,
  config: QwenProviderConfig,
): (string | number | boolean | undefined)[] {
  return [
    PROVIDER_ID,
    query,
    model,
    config.searchStrategy ?? "turbo",
    config.forcedSearch ?? false,
    config.enableThinking ?? false,
    config.enableSearchExtension ?? false,
    config.freshness ?? undefined,
    config.enableSource ?? true,
    config.enableCitation ?? false,
  ];
}

// ── Tool Definition ──

function createToolDefinition(
  searchConfig?: SearchConfigRecord,
): WebSearchProviderToolDefinition {
  const config = resolveQwenConfig(searchConfig);

  return {
    description:
      "通过阿里云百炼平台 DashScope 原生协议执行联网搜索。" +
      "支持搜索来源返回、角标引用标注、高级搜索参数和深度思考模式。",
    parameters: buildSearchToolSchema(),
    execute: async (args) => {
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        return buildMissingKeyError(
          PROVIDER_ID,
          ENV_VARS[0],
          CREDENTIAL_PATH,
          "https://help.aliyun.com/zh/model-studio/web-search",
        );
      }

      const query = readStringParam(args as Record<string, unknown>, "query", {
        required: true,
      });
      const model = resolveModel(config);

      const cacheKey = buildSearchCacheKey(buildCacheKeyFactors(query, model, config));
      const cached = readCachedSearchPayload(cacheKey);
      if (cached) {
        return cached;
      }

      const timeoutSeconds = resolveTimeoutSeconds(config, searchConfig);
      const body = buildRequestBody(query, model, config);

      const start = Date.now();

      const payload: SearchToolResult = await withTrustedWebSearchEndpoint(
        {
          url: DASHSCOPE_ENDPOINT,
          timeoutSeconds,
          init: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
          },
        },
        async (res) => {
          if (!res.ok) {
            const detail = await res.text();
            return buildDashScopeApiError(PROVIDER_ID, res.status, detail) as never;
          }

          const data = (await res.json()) as DashScopeResponse;
          const content =
            data.output?.choices?.[0]?.message?.content?.trim() || "未返回搜索结果。";
          const citations = extractCitations(data);

          return {
            query,
            provider: PROVIDER_ID,
            model,
            tookMs: Date.now() - start,
            externalContent: {
              untrusted: true as const,
              source: "web_search" as const,
              provider: PROVIDER_ID,
              wrapped: true as const,
            },
            content: wrapWebContent(content),
            citations,
          };
        },
      );

      writeCachedSearchPayload(cacheKey, payload, resolveSearchCacheTtlMs(searchConfig));
      return payload;
    },
  };
}

// ── Provider Plugin 实例 ──

export function createQwenDashScopeProvider(): WebSearchProviderPlugin {
  return {
    id: PROVIDER_ID,
    label: "通义百炼搜索 (DashScope)",
    hint: "通过阿里云百炼平台 DashScope 原生协议实现联网搜索，支持搜索来源返回与角标标注",
    envVars: ENV_VARS,
    placeholder: "sk-...",
    signupUrl: "https://dashscope.aliyun.com/",
    docsUrl: "https://help.aliyun.com/zh/model-studio/web-search",
    autoDetectOrder: 50,
    credentialPath: CREDENTIAL_PATH,
    inactiveSecretPaths: [CREDENTIAL_PATH],

    getCredentialValue: (searchConfig) =>
      getScopedCredentialValue(searchConfig, SCOPE_KEY),

    setCredentialValue: (searchConfigTarget, value) =>
      setScopedCredentialValue(searchConfigTarget, SCOPE_KEY, value),

    getConfiguredCredentialValue: (config) =>
      resolveProviderWebSearchPluginConfig(config, PLUGIN_ID)?.apiKey,

    setConfiguredCredentialValue: (configTarget, value) => {
      setProviderWebSearchPluginConfigValue(configTarget, PLUGIN_ID, "apiKey", value);
    },

    createTool: (ctx) =>
      createToolDefinition(
        (() => {
          const searchConfig = ctx.searchConfig as SearchConfigRecord | undefined;
          const pluginConfig = resolveProviderWebSearchPluginConfig(ctx.config, PLUGIN_ID);
          if (!pluginConfig) {
            return searchConfig;
          }
          return mergeScopedSearchConfig(
            searchConfig,
            SCOPE_KEY,
            pluginConfig,
          ) as SearchConfigRecord | undefined;
        })(),
      ),
  };
}

export const __testing = {
  resolveQwenConfig,
  resolveApiKey,
  resolveModel,
  resolveTimeoutSeconds,
  extractCitations,
  buildRequestBody,
  buildCacheKeyFactors,
  PROVIDER_ID,
  DASHSCOPE_ENDPOINT,
  DEFAULT_MODEL,
} as const;

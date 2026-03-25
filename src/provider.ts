import { Type } from "@sinclair/typebox";
import {
  buildSearchCacheKey,
  readCachedSearchPayload,
  readConfiguredSecretString,
  readNumberParam,
  readProviderEnvValue,
  readStringParam,
  resolveSearchCacheTtlMs,
  resolveSearchTimeoutSeconds,
  withTrustedWebSearchEndpoint,
  wrapWebContent,
  writeCachedSearchPayload,
  type SearchConfigRecord,
  type WebSearchProviderPlugin,
  type WebSearchProviderToolDefinition,
} from "openclaw/plugin-sdk/provider-web-search";

type PluginConfig = {
  apiKey?: string | Record<string, unknown>;
  baseUrl?: string;
  timeoutSeconds?: number;
};

type SearchResponse = {
  summary?: string;
  citations?: string[];
};

const DEFAULT_BASE_URL = "https://example.com/openclaw-web-search";
const DEFAULT_TIMEOUT_SECONDS = 20;
const MAX_COUNT = 10;

const searchSchema = Type.Object(
  {
    query: Type.String({ description: "搜索关键字。" }),
    count: Type.Optional(
      Type.Number({
        description: "返回结果数量，范围 1-10。",
        minimum: 1,
        maximum: MAX_COUNT,
      }),
    ),
  },
  { additionalProperties: false },
);

function resolvePluginConfig(searchConfig?: SearchConfigRecord): PluginConfig {
  const scoped = searchConfig?.openclawWebSearch;
  return scoped && typeof scoped === "object" && !Array.isArray(scoped)
    ? (scoped as PluginConfig)
    : {};
}

function resolveApiKey(config: PluginConfig): string | undefined {
  return (
    readConfiguredSecretString(config.apiKey, "tools.web.search.openclawWebSearch.apiKey") ??
    readProviderEnvValue(["OPENCLAW_WEB_SEARCH_API_KEY"])
  );
}

function resolveBaseUrl(config: PluginConfig): string {
  return typeof config.baseUrl === "string" && config.baseUrl.trim()
    ? config.baseUrl.trim()
    : DEFAULT_BASE_URL;
}

function resolveTimeoutSeconds(config: PluginConfig, searchConfig?: SearchConfigRecord): number {
  if (typeof config.timeoutSeconds === "number" && Number.isFinite(config.timeoutSeconds)) {
    return config.timeoutSeconds;
  }
  return searchConfig ? resolveSearchTimeoutSeconds(searchConfig) : DEFAULT_TIMEOUT_SECONDS;
}

function setScopedConfigValue(
  searchConfigTarget: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  const current =
    searchConfigTarget.openclawWebSearch &&
    typeof searchConfigTarget.openclawWebSearch === "object" &&
    !Array.isArray(searchConfigTarget.openclawWebSearch)
      ? (searchConfigTarget.openclawWebSearch as Record<string, unknown>)
      : {};
  searchConfigTarget.openclawWebSearch = {
    ...current,
    [key]: value,
  };
}

function createToolDefinition(searchConfig?: SearchConfigRecord): WebSearchProviderToolDefinition {
  const config = resolvePluginConfig(searchConfig);

  return {
    description:
      "使用独立仓库的 openclaw-web-search 插件执行联网搜索，并返回摘要与引用链接。",
    parameters: searchSchema,
    execute: async (args) => {
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        return {
          error: "missing_openclaw_web_search_api_key",
          message:
            "缺少 web_search 凭据。请设置 plugins.entries.openclaw-web-search.config.webSearch.apiKey 或环境变量 OPENCLAW_WEB_SEARCH_API_KEY。",
        };
      }

      const query = readStringParam(args, "query", { required: true });
      const count = Math.max(
        1,
        Math.min(MAX_COUNT, readNumberParam(args, "count", { integer: true }) ?? 5),
      );
      const baseUrl = resolveBaseUrl(config);
      const cacheKey = buildSearchCacheKey(["openclaw-web-search", query, count, baseUrl]);
      const cached = readCachedSearchPayload(cacheKey);
      if (cached) {
        return cached;
      }

      const payload = await withTrustedWebSearchEndpoint(
        {
          url: `${baseUrl.replace(/\/$/, "")}/search`,
          timeoutSeconds: resolveTimeoutSeconds(config, searchConfig),
          init: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ query, count }),
          },
        },
        async (res) => {
          if (!res.ok) {
            const detail = await res.text();
            throw new Error(
              `openclaw-web-search 请求失败 (${res.status}): ${detail || res.statusText}`,
            );
          }

          const json = (await res.json()) as SearchResponse;
          return {
            query,
            provider: "openclaw-web-search",
            content: wrapWebContent(json.summary?.trim() || "未返回摘要内容。"),
            citations: Array.isArray(json.citations) ? json.citations : [],
          };
        },
      );

      writeCachedSearchPayload(cacheKey, payload, resolveSearchCacheTtlMs(searchConfig));
      return payload;
    },
  };
}

export function createOpenClawWebSearchProvider(): WebSearchProviderPlugin {
  return {
    id: "openclaw-web-search",
    label: "OpenClaw Web Search",
    hint: "独立仓库开发的外部 web_search 插件",
    credentialLabel: "Web Search API key",
    envVars: ["OPENCLAW_WEB_SEARCH_API_KEY"],
    placeholder: "ws_...",
    signupUrl: "https://example.com/openclaw-web-search",
    docsUrl: "https://github.com/openclaw/openclaw/tree/main/openclaw-web-search",
    credentialPath: "plugins.entries.openclaw-web-search.config.webSearch.apiKey",
    inactiveSecretPaths: ["plugins.entries.openclaw-web-search.config.webSearch.apiKey"],
    getCredentialValue: (searchConfig) =>
      searchConfig &&
      typeof searchConfig.openclawWebSearch === "object" &&
      !Array.isArray(searchConfig.openclawWebSearch)
        ? (searchConfig.openclawWebSearch as Record<string, unknown>).apiKey
        : undefined,
    setCredentialValue: (searchConfigTarget, value) => {
      setScopedConfigValue(searchConfigTarget, "apiKey", value);
    },
    getConfiguredCredentialValue: (config) => {
      const entries = config?.plugins?.entries;
      const currentEntry =
        entries && typeof entries["openclaw-web-search"] === "object"
          ? (entries["openclaw-web-search"] as Record<string, unknown>)
          : null;
      const currentConfig =
        currentEntry?.config && typeof currentEntry.config === "object"
          ? (currentEntry.config as Record<string, unknown>)
          : null;
      const currentWebSearch =
        currentConfig?.webSearch && typeof currentConfig.webSearch === "object"
          ? (currentConfig.webSearch as Record<string, unknown>)
          : null;
      return currentWebSearch?.apiKey;
    },
    setConfiguredCredentialValue: (configTarget, value) => {
      const plugins = configTarget.plugins ?? {};
      const entries = plugins.entries ?? {};
      const currentEntry =
        entries["openclaw-web-search"] &&
        typeof entries["openclaw-web-search"] === "object"
          ? entries["openclaw-web-search"]
          : {};
      const currentConfig =
        "config" in currentEntry &&
        currentEntry.config &&
        typeof currentEntry.config === "object" &&
        !Array.isArray(currentEntry.config)
          ? (currentEntry.config as Record<string, unknown>)
          : {};
      const currentWebSearch =
        currentConfig.webSearch &&
        typeof currentConfig.webSearch === "object" &&
        !Array.isArray(currentConfig.webSearch)
          ? (currentConfig.webSearch as Record<string, unknown>)
          : {};

      configTarget.plugins = {
        ...plugins,
        entries: {
          ...entries,
          "openclaw-web-search": {
            ...currentEntry,
            config: {
              ...currentConfig,
              webSearch: {
                ...currentWebSearch,
                apiKey: value,
              },
            },
          },
        },
      };
    },
    createTool: ({ searchConfig }) => createToolDefinition(searchConfig),
  };
}

import { Type } from "@sinclair/typebox";
import {
  buildSearchCacheKey,
  getScopedCredentialValue,
  mergeScopedSearchConfig,
  readCachedSearchPayload,
  readStringParam,
  resolveSearchCacheTtlMs,
  resolveSearchTimeoutSeconds,
  setScopedCredentialValue,
  withTrustedWebSearchEndpoint,
  wrapWebContent,
  writeCachedSearchPayload,
  type SearchConfigRecord,
  type WebSearchProviderPlugin,
  type WebSearchProviderToolDefinition,
} from "openclaw/plugin-sdk/provider-web-search";

import {
  buildApiError,
  buildJsonApiError,
  buildMissingKeyError,
  extractUrlsFromText,
  parseSseDataPayloads,
  resolveCredential,
  resolvePluginScopedConfig,
  setPluginScopedConfigValue,
  type SearchToolError,
  type SearchToolResult,
} from "../shared/index.js";
import type {
  MetasoMode,
  MetasoProviderConfig,
  MetasoResearchModel,
  MetasoSearchItem,
} from "./types.js";

const PROVIDER_ID = "metaso";
const PLUGIN_ID = "openclaw-web-search";
const SCOPE_KEY = "metaso";
const ENV_VARS = ["METASO_API_KEY"];
const SECRET_PATH = "tools.web.search.metaso.apiKey";
const CREDENTIAL_PATH = `plugins.entries.${PLUGIN_ID}.config.metaso.apiKey`;
const SEARCH_ENDPOINT = "https://metaso.cn/api/v1/search";
const READER_ENDPOINT = "https://metaso.cn/api/v1/reader";
const RESEARCH_ENDPOINT = "https://metaso.cn/api/v1/chat/completions";
const DEFAULT_MODE: MetasoMode = "search";
const DEFAULT_SCOPE = "webpage";
const DEFAULT_SIZE = 10;
const DEFAULT_RESEARCH_MODEL: MetasoResearchModel = "fast_thinking";
const DEFAULT_TIMEOUT_SECONDS = 30;
const CACHE_FORMAT_VERSION = "v2";

const toolSchema = Type.Object(
  {
    mode: Type.Optional(
      Type.Union([
        Type.Literal("search"),
        Type.Literal("reader"),
        Type.Literal("deep_research"),
      ], { description: "执行模式：search、reader 或 deep_research。" }),
    ),
    query: Type.Optional(Type.String({ description: "search 与 deep_research 模式下的查询词。" })),
    url: Type.Optional(Type.String({ description: "reader 模式下要读取的网页 URL。" })),
    scope: Type.Optional(Type.String({ description: "search 模式的 scope，默认 webpage。" })),
    size: Type.Optional(Type.Number({ description: "search 模式返回条数，默认 10。", minimum: 1, maximum: 10 })),
    includeSummary: Type.Optional(Type.Boolean({ description: "search 模式是否请求摘要。" })),
    includeRawContent: Type.Optional(Type.Boolean({ description: "search 模式是否返回原始正文。" })),
    conciseSnippet: Type.Optional(Type.Boolean({ description: "search 模式是否请求简洁结果片段。" })),
    model: Type.Optional(Type.String({ description: "deep_research 模式模型，可选 fast、fast_thinking、ds-r1。" })),
  },
  { additionalProperties: false },
);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getPath(root: unknown, path: string[]): unknown {
  let current = root;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[segment];
  }
  return current;
}

function firstString(root: unknown, paths: string[][]): string | undefined {
  for (const path of paths) {
    const value = getPath(root, path);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function firstArray(root: unknown, paths: string[][]): unknown[] {
  for (const path of paths) {
    const value = getPath(root, path);
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function resolveMetasoConfig(searchConfig?: SearchConfigRecord): MetasoProviderConfig {
  const scoped = searchConfig?.[SCOPE_KEY];
  return scoped && typeof scoped === "object" && !Array.isArray(scoped)
    ? (scoped as MetasoProviderConfig)
    : {};
}

function resolveApiKey(config: MetasoProviderConfig): string | undefined {
  return resolveCredential(config.apiKey, SECRET_PATH, ENV_VARS);
}

function resolveTimeoutSeconds(
  config: MetasoProviderConfig,
  searchConfig?: SearchConfigRecord,
): number {
  if (typeof config.timeoutSeconds === "number" && Number.isFinite(config.timeoutSeconds)) {
    return config.timeoutSeconds;
  }
  return searchConfig ? resolveSearchTimeoutSeconds(searchConfig) : DEFAULT_TIMEOUT_SECONDS;
}

function resolveMode(args: Record<string, unknown>, config: MetasoProviderConfig): MetasoMode {
  if (args.mode === "search" || args.mode === "reader" || args.mode === "deep_research") {
    return args.mode;
  }
  if (config.mode === "search" || config.mode === "reader" || config.mode === "deep_research") {
    return config.mode;
  }
  return DEFAULT_MODE;
}

function resolveSearchOptions(args: Record<string, unknown>, config: MetasoProviderConfig) {
  const size =
    typeof args.size === "number" && Number.isFinite(args.size)
      ? Math.max(1, Math.min(10, Math.floor(args.size)))
      : typeof config.size === "number" && Number.isFinite(config.size)
        ? Math.max(1, Math.min(10, Math.floor(config.size)))
        : DEFAULT_SIZE;

  return {
    scope:
      typeof args.scope === "string" && args.scope.trim()
        ? args.scope.trim()
        : config.scope?.trim() || DEFAULT_SCOPE,
    size,
    includeSummary:
      typeof args.includeSummary === "boolean" ? args.includeSummary : config.includeSummary ?? true,
    includeRawContent:
      typeof args.includeRawContent === "boolean"
        ? args.includeRawContent
        : config.includeRawContent ?? false,
    conciseSnippet:
      typeof args.conciseSnippet === "boolean"
        ? args.conciseSnippet
        : config.conciseSnippet ?? false,
  };
}

function resolveResearchModel(args: Record<string, unknown>, config: MetasoProviderConfig): string {
  if (typeof args.model === "string" && args.model.trim()) {
    return args.model.trim();
  }
  if (typeof config.deepResearchModel === "string" && config.deepResearchModel.trim()) {
    return config.deepResearchModel.trim();
  }
  return DEFAULT_RESEARCH_MODEL;
}

function normalizeSearchItems(data: unknown): MetasoSearchItem[] {
  return firstArray(data, [
    ["webpages"],
    ["results"],
    ["items"],
    ["data", "webpages"],
    ["data", "results"],
    ["data", "items"],
    ["data", "list"],
  ])
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return undefined;
      const item: MetasoSearchItem = {
        title: firstString(record, [["title"], ["name"]]),
        url: firstString(record, [["url"], ["link"], ["href"]]),
        summary: firstString(record, [["summary"], ["snippet"], ["description"], ["content"], ["abstract"]]),
      };
      return item.url || item.title || item.summary ? item : undefined;
    })
    .filter((item): item is MetasoSearchItem => Boolean(item));
}

function formatSearchContent(data: unknown): string {
  const summary = firstString(data, [["summary"], ["answer"], ["data", "summary"], ["data", "answer"]]);
  const items = normalizeSearchItems(data);
  const sections: string[] = [];

  if (summary) {
    sections.push(summary);
  }

  if (items.length > 0) {
    sections.push(
      items
        .map((item, index) => {
          const lines = [`${index + 1}. ${item.title || item.url || "未命名结果"}`];
          if (item.url) lines.push(item.url);
          if (item.summary) lines.push(item.summary);
          return lines.join("\n");
        })
        .join("\n\n"),
    );
  }

  return sections.join("\n\n").trim() || "未返回搜索结果。";
}

function extractSearchCitations(data: unknown, content: string): string[] {
  const urls = new Set<string>();
  for (const item of normalizeSearchItems(data)) {
    if (item.url) {
      urls.add(item.url);
    }
  }
  for (const url of extractUrlsFromText(content)) {
    urls.add(url);
  }
  return [...urls];
}

function appendStreamingText(current: string, fragment: string): string {
  if (!fragment) return current;
  if (!current) return fragment;
  if (fragment.startsWith(current)) return fragment;
  if (current.endsWith(fragment)) return current;
  return `${current}${fragment}`;
}

function extractResearchText(payload: unknown): string {
  const choices = firstArray(payload, [["choices"]]);
  let content = "";

  for (const choice of choices) {
    const fragment = firstString(choice, [["delta", "content"], ["message", "content"], ["content"], ["text"]]);
    if (fragment) {
      content = appendStreamingText(content, fragment);
    }
  }

  return content || firstString(payload, [["content"], ["text"], ["message"], ["answer"]]) || "";
}

function extractResearchCitations(payload: unknown): string[] {
  const urls = new Set<string>();
  const candidates = [
    ...firstArray(payload, [["citations"], ["references"], ["urls"], ["source_urls"]]),
    ...firstArray(payload, [["choices"]]).flatMap((choice) => firstArray(choice, [["citations"], ["references"]])),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      urls.add(candidate.trim());
      continue;
    }
    const record = asRecord(candidate);
    const url = record ? firstString(record, [["url"], ["href"], ["link"]]) : undefined;
    if (url) {
      urls.add(url);
    }
  }

  return [...urls];
}

function parseResearchPayload(raw: string): { content: string; citations: string[] } {
  const payloads = parseSseDataPayloads(raw);
  if (payloads.length === 0) {
    return {
      content: raw.trim(),
      citations: extractUrlsFromText(raw),
    };
  }

  let content = "";
  const citations = new Set<string>();

  for (const payload of payloads) {
    if (payload === "[DONE]") {
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as unknown;
      const fragment = extractResearchText(parsed);
      if (fragment) {
        content = appendStreamingText(content, fragment);
      }
      for (const url of extractResearchCitations(parsed)) {
        citations.add(url);
      }
    } catch {
      content = appendStreamingText(content, payload);
    }
  }

  if (!content.trim()) {
    content = raw.trim();
  }
  for (const url of extractUrlsFromText(content)) {
    citations.add(url);
  }

  return {
    content: content.trim() || "未返回深度研究结果。",
    citations: [...citations],
  };
}

function buildCacheKeyFactors(
  mode: MetasoMode,
  primaryInput: string,
  extra: Array<string | number | boolean>,
): Array<string | number | boolean> {
  return [PROVIDER_ID, CACHE_FORMAT_VERSION, mode, primaryInput, ...extra];
}

function buildModeApiError(mode: MetasoMode, status: number, responseBody: string): SearchToolError {
  return buildJsonApiError(`metaso_${mode}`, status, responseBody, {
    errorId: `metaso_${mode}_api_error`,
    codeKeys: ["code", "error_code"],
    messageKeys: ["message", "error", "detail"],
    requestIdKeys: ["request_id", "requestId"],
    codeProperty: "provider_code",
  });
}

function buildSearchPayload(
  query: string,
  content: string,
  citations: string[],
  start: number,
): SearchToolResult {
  return {
    query,
    provider: PROVIDER_ID,
    tookMs: Date.now() - start,
    externalContent: {
      untrusted: true,
      source: "web_search",
      provider: PROVIDER_ID,
      wrapped: true,
    },
    content: wrapWebContent(content),
    citations,
  };
}

function createToolDefinition(searchConfig?: SearchConfigRecord): WebSearchProviderToolDefinition {
  const config = resolveMetasoConfig(searchConfig);

  return {
    description: "通过秘塔搜索执行简单搜索、网页读取和深度研究。默认使用 search 模式。",
    parameters: toolSchema,
    execute: async (args) => {
      const params = args as Record<string, unknown>;
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        return buildMissingKeyError(
          PROVIDER_ID,
          ENV_VARS[0],
          CREDENTIAL_PATH,
          "https://metaso.cn/search-api/playground",
        );
      }

      const mode = resolveMode(params, config);
      const timeoutSeconds = resolveTimeoutSeconds(config, searchConfig);
      const start = Date.now();

      if (mode === "reader") {
        const url = readStringParam(params, "url", { required: true });
        const cacheKey = buildSearchCacheKey(buildCacheKeyFactors(mode, url, []));
        const cached = readCachedSearchPayload(cacheKey);
        if (cached) {
          return cached;
        }

        const payload = await withTrustedWebSearchEndpoint(
          {
            url: READER_ENDPOINT,
            timeoutSeconds,
            init: {
              method: "POST",
              headers: {
                Accept: "text/plain",
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({ url }),
            },
          },
          async (res) => {
            if (!res.ok) {
              return buildModeApiError(mode, res.status, await res.text()) as never;
            }

            const content = (await res.text()).trim();
            if (!content) {
              return buildApiError("metaso_reader", res.status, "空响应正文") as never;
            }

            return buildSearchPayload(url, content, [...new Set([url, ...extractUrlsFromText(content)])], start);
          },
        );

        writeCachedSearchPayload(cacheKey, payload, resolveSearchCacheTtlMs(searchConfig));
        return payload;
      }

      if (mode === "deep_research") {
        const query = readStringParam(params, "query", { required: true });
        const model = resolveResearchModel(params, config);
        const cacheKey = buildSearchCacheKey(buildCacheKeyFactors(mode, query, [model]));
        const cached = readCachedSearchPayload(cacheKey);
        if (cached) {
          return cached;
        }

        const payload = await withTrustedWebSearchEndpoint(
          {
            url: RESEARCH_ENDPOINT,
            timeoutSeconds,
            init: {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                stream: true,
                messages: [{ role: "user", content: query }],
              }),
            },
          },
          async (res) => {
            if (!res.ok) {
              return buildModeApiError(mode, res.status, await res.text()) as never;
            }

            const parsed = parseResearchPayload(await res.text());
            return {
              ...buildSearchPayload(query, parsed.content, parsed.citations, start),
              model,
            };
          },
        );

        writeCachedSearchPayload(cacheKey, payload, resolveSearchCacheTtlMs(searchConfig));
        return payload;
      }

      const query = readStringParam(params, "query", { required: true });
      const options = resolveSearchOptions(params, config);
      const cacheKey = buildSearchCacheKey(buildCacheKeyFactors(mode, query, [
        options.scope,
        options.size,
        options.includeSummary,
        options.includeRawContent,
        options.conciseSnippet,
      ]));
      const cached = readCachedSearchPayload(cacheKey);
      if (cached) {
        return cached;
      }

      const payload = await withTrustedWebSearchEndpoint(
        {
          url: SEARCH_ENDPOINT,
          timeoutSeconds,
          init: {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              q: query,
              scope: options.scope,
              includeSummary: options.includeSummary,
              size: String(options.size),
              includeRawContent: options.includeRawContent,
              conciseSnippet: options.conciseSnippet,
            }),
          },
        },
        async (res) => {
          if (!res.ok) {
            return buildModeApiError(mode, res.status, await res.text()) as never;
          }

          const data = (await res.json()) as unknown;
          const content = formatSearchContent(data);
          return buildSearchPayload(query, content, extractSearchCitations(data, content), start);
        },
      );

      writeCachedSearchPayload(cacheKey, payload, resolveSearchCacheTtlMs(searchConfig));
      return payload;
    },
  };
}

export function createMetasoProvider(): WebSearchProviderPlugin {
  return {
    id: PROVIDER_ID,
    label: "Metaso",
    hint: "Requires Metaso API key · search, reader and deep research modes",
    envVars: ENV_VARS,
    placeholder: "mk-...",
    signupUrl: "https://metaso.cn/search-api/playground",
    docsUrl: "https://metaso.cn/search-api/playground",
    autoDetectOrder: 60,
    credentialPath: CREDENTIAL_PATH,
    inactiveSecretPaths: [CREDENTIAL_PATH],
    getCredentialValue: (searchConfig) => getScopedCredentialValue(searchConfig, SCOPE_KEY),
    setCredentialValue: (searchConfigTarget, value) =>
      setScopedCredentialValue(searchConfigTarget, SCOPE_KEY, value),
    getConfiguredCredentialValue: (config) =>
      resolvePluginScopedConfig(config as Record<string, unknown> | undefined, PLUGIN_ID, SCOPE_KEY)
        ?.apiKey,
    setConfiguredCredentialValue: (configTarget, value) => {
      setPluginScopedConfigValue(
        configTarget as Record<string, unknown>,
        PLUGIN_ID,
        SCOPE_KEY,
        "apiKey",
        value,
      );
    },
    createTool: (ctx) =>
      createToolDefinition(
        (() => {
          const searchConfig = ctx.searchConfig as SearchConfigRecord | undefined;
          const rawConfig = ctx.config as Record<string, unknown> | undefined;
          const pluginConfig = resolvePluginScopedConfig(rawConfig, PLUGIN_ID, SCOPE_KEY);
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
  buildModeApiError,
  PROVIDER_ID,
  CACHE_FORMAT_VERSION,
  SEARCH_ENDPOINT,
  READER_ENDPOINT,
  RESEARCH_ENDPOINT,
  DEFAULT_MODE,
  DEFAULT_RESEARCH_MODEL,
} as const;
/**
 * Provider 基础配置类型——各 Provider 的配置接口继承此类型
 */
export type ProviderConfig = {
  apiKey?: string | Record<string, unknown>;
  timeoutSeconds?: number;
};

/**
 * 标准搜索工具返回结构
 */
export type SearchToolResult = {
  query: string;
  provider: string;
  model?: string;
  tookMs?: number;
  externalContent?: {
    untrusted: true;
    source: "web_search";
    provider: string;
    wrapped: true;
  };
  content: string;
  citations: string[];
};

/**
 * 标准错误返回结构（不抛出异常，以对象形式返回）
 */
export type SearchToolError = {
  error: string;
  message: string;
  status?: number;
  docs?: string;
  dashscope_code?: string;
  request_id?: string;
};

// ── DashScope 原生协议响应类型 ──

export type DashScopeSearchResult = {
  index: number;
  title: string;
  url: string;
  site_name?: string;
  icon?: string;
};

export type DashScopeSearchInfo = {
  search_results?: DashScopeSearchResult[];
  extra_tool_info?: Array<{ type?: string; result?: unknown }>;
};

export type DashScopeChoice = {
  message: {
    role: string;
    content: string | null;
    reasoning_content?: string;
  };
  finish_reason: string;
};

export type DashScopeOutput = {
  choices: DashScopeChoice[];
  search_info?: DashScopeSearchInfo;
};

export type DashScopeUsage = {
  total_tokens?: number;
  output_tokens?: number;
  input_tokens?: number;
  plugins?: {
    search?: { count?: number };
  };
};

/**
 * DashScope 原生协议完整响应结构
 */
export type DashScopeResponse = {
  output: DashScopeOutput;
  usage?: DashScopeUsage;
  request_id?: string;
};

/**
 * DashScope 原生协议错误响应结构
 */
export type DashScopeErrorResponse = {
  code?: string;
  message?: string;
  request_id?: string;
};

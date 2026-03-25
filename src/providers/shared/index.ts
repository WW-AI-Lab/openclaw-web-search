export type {
  ProviderConfig,
  SearchToolResult,
  SearchToolError,
  DashScopeResponse,
  DashScopeErrorResponse,
  DashScopeSearchInfo,
  DashScopeSearchResult,
  DashScopeChoice,
  DashScopeOutput,
  DashScopeUsage,
} from "./types.js";

export { resolveCredential, resolveProviderConfig } from "./config.js";
export { buildMissingKeyError, buildApiError, buildDashScopeApiError } from "./errors.js";
export { buildSearchToolSchema } from "./schema.js";

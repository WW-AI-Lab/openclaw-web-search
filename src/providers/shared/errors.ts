import type { SearchToolError, DashScopeErrorResponse } from "./types.js";

type JsonApiErrorOptions = {
  errorId?: string;
  codeKeys?: string[];
  messageKeys?: string[];
  requestIdKeys?: string[];
  codeProperty?: "provider_code" | "dashscope_code";
};

function readStringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * 构建缺少 API Key 的标准化错误对象
 */
export function buildMissingKeyError(
  providerId: string,
  envVar: string,
  configPath: string,
  docs?: string,
): SearchToolError {
  const errorId = `missing_${providerId.replace(/-/g, "_")}_api_key`;
  return {
    error: errorId,
    message: `缺少 ${providerId} 凭据。请通过以下任一方式设置：\n` +
      `  1. 配置项: ${configPath}\n` +
      `  2. 环境变量: ${envVar}`,
    ...(docs ? { docs } : {}),
  };
}

/**
 * 构建通用 API 请求失败的标准化错误对象（不含 API Key）
 */
export function buildApiError(
  providerId: string,
  status: number,
  statusText: string,
): SearchToolError {
  const errorId = `${providerId.replace(/-/g, "_")}_api_error`;
  return {
    error: errorId,
    message: `${providerId} 请求失败 (HTTP ${status}): ${statusText}`,
    status,
  };
}

export function buildJsonApiError(
  providerId: string,
  status: number,
  responseBody: string,
  options: JsonApiErrorOptions = {},
): SearchToolError {
  try {
    const parsed = JSON.parse(responseBody) as Record<string, unknown>;
    const code = readStringField(parsed, options.codeKeys ?? ["code", "error_code"]);
    const message = readStringField(parsed, options.messageKeys ?? ["message", "error", "detail"]);
    const requestId = readStringField(parsed, options.requestIdKeys ?? ["request_id", "requestId"]);

    if (code || message || requestId) {
      const payload: SearchToolError = {
        error: options.errorId ?? `${providerId.replace(/-/g, "_")}_api_error`,
        message:
          code && message
            ? `${providerId} 请求失败 (HTTP ${status}): [${code}] ${message}`
            : `${providerId} 请求失败 (HTTP ${status}): ${message ?? responseBody ?? `HTTP ${status}`}`,
        status,
      };

      if (requestId) {
        payload.request_id = requestId;
      }

      if (code && options.codeProperty === "dashscope_code") {
        payload.dashscope_code = code;
      }
      if (code && options.codeProperty !== "dashscope_code") {
        payload.provider_code = code;
      }

      return payload;
    }
  } catch {
    // JSON 解析失败，回退到通用错误
  }

  return buildApiError(providerId, status, responseBody || `HTTP ${status}`);
}

/**
 * 解析 DashScope 原生协议的错误响应 { code, message, request_id }
 * 并构建包含原始错误码的标准化错误对象
 */
export function buildDashScopeApiError(
  providerId: string,
  status: number,
  responseBody: string,
): SearchToolError {
  return buildJsonApiError(providerId, status, responseBody, {
    codeKeys: ["code"],
    messageKeys: ["message"],
    requestIdKeys: ["request_id"],
    codeProperty: "dashscope_code",
  });
}

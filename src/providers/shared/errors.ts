import type { SearchToolError, DashScopeErrorResponse } from "./types.js";

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

/**
 * 解析 DashScope 原生协议的错误响应 { code, message, request_id }
 * 并构建包含原始错误码的标准化错误对象
 */
export function buildDashScopeApiError(
  providerId: string,
  status: number,
  responseBody: string,
): SearchToolError {
  try {
    const parsed = JSON.parse(responseBody) as DashScopeErrorResponse;
    if (parsed.code && parsed.message) {
      return {
        error: `${providerId.replace(/-/g, "_")}_api_error`,
        message: `${providerId} 请求失败 (HTTP ${status}): [${parsed.code}] ${parsed.message}`,
        status,
        dashscope_code: parsed.code,
        request_id: parsed.request_id,
      };
    }
  } catch {
    // JSON 解析失败，回退到通用错误
  }
  return buildApiError(providerId, status, responseBody || `HTTP ${status}`);
}

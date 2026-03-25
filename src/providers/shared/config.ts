import {
  readConfiguredSecretString,
  readProviderEnvValue,
  resolveProviderWebSearchPluginConfig,
  type SearchConfigRecord,
} from "openclaw/plugin-sdk/provider-web-search";

import type { ProviderConfig } from "./types.js";

/**
 * 通用凭据解析链：插件配置 → 旧式搜索配置 → 环境变量
 *
 * @param pluginId   - 插件 ID（用于 resolveProviderWebSearchPluginConfig）
 * @param scopeKey   - scoped config 的键名（如 "qwen"）
 * @param envVars    - 环境变量名数组（如 ["DASHSCOPE_API_KEY"]）
 * @param apiKeyValue - 从 scoped config 读到的 apiKey 值（可为 string 或 secret ref 对象）
 * @param secretPath - 旧式配置的 secret 路径
 */
export function resolveCredential(
  apiKeyValue: unknown,
  secretPath: string,
  envVars: string[],
): string | undefined {
  return (
    readConfiguredSecretString(apiKeyValue, secretPath) ??
    readProviderEnvValue(envVars)
  );
}

/**
 * 通用配置合并读取——将插件配置覆盖到 scoped search config 上
 *
 * @param searchConfig - 当前的 SearchConfigRecord
 * @param scopeKey     - scoped config 的键名
 * @param pluginId     - 插件 ID
 * @param config       - OpenClaw 全局配置对象
 */
export function resolveProviderConfig<T extends ProviderConfig>(
  searchConfig: SearchConfigRecord | undefined,
  scopeKey: string,
  pluginId: string,
  config: Record<string, unknown> | undefined,
): T {
  const scoped = searchConfig?.[scopeKey];
  const scopedConfig =
    scoped && typeof scoped === "object" && !Array.isArray(scoped)
      ? (scoped as Record<string, unknown>)
      : {};

  const pluginConfig = resolveProviderWebSearchPluginConfig(config, pluginId);
  if (!pluginConfig) {
    return scopedConfig as T;
  }

  return { ...scopedConfig, ...pluginConfig } as T;
}

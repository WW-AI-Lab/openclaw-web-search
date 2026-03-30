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

function ensureRecord(target: Record<string, unknown>, key: string): Record<string, unknown> {
  const current = target[key];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current as Record<string, unknown>;
  }
  const next: Record<string, unknown> = {};
  target[key] = next;
  return next;
}

export function resolvePluginScopedConfig(
  config: Record<string, unknown> | undefined,
  pluginId: string,
  scopeKey: string,
): Record<string, unknown> | undefined {
  if (!config) return undefined;
  const plugins = config.plugins as Record<string, unknown> | undefined;
  const entries = plugins?.entries as Record<string, unknown> | undefined;
  const entry = entries?.[pluginId] as Record<string, unknown> | undefined;
  const pluginConfig = entry?.config as Record<string, unknown> | undefined;
  const scopedConfig = pluginConfig?.[scopeKey];
  if (scopedConfig && typeof scopedConfig === "object" && !Array.isArray(scopedConfig)) {
    return scopedConfig as Record<string, unknown>;
  }
  return undefined;
}

export function setPluginScopedConfigValue(
  configTarget: Record<string, unknown>,
  pluginId: string,
  scopeKey: string,
  key: string,
  value: unknown,
): void {
  const plugins = ensureRecord(configTarget, "plugins");
  const entries = ensureRecord(plugins, "entries");
  const entry = ensureRecord(entries, pluginId);
  if (entry.enabled === undefined) {
    entry.enabled = true;
  }
  const config = ensureRecord(entry, "config");
  const scoped = ensureRecord(config, scopeKey);
  scoped[key] = value;
}

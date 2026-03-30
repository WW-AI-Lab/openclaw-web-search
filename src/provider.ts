import type { WebSearchProviderPlugin } from "openclaw/plugin-sdk/provider-web-search";

import { createMetasoProvider } from "./providers/metaso/metaso-provider.js";
import { createQwenProvider } from "./providers/qwen/qwen-provider.js";

/**
 * 返回本插件提供的所有搜索 Provider
 * 新增 Provider 时只需在数组中追加即可
 */
export function getAllProviders(): WebSearchProviderPlugin[] {
  return [
    createQwenProvider(),
    createMetasoProvider(),
  ];
}

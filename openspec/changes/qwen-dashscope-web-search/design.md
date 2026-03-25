## Context

`openclaw-web-search` 是 OpenClaw 的独立外部插件，当前插件骨架已就绪但所有 Provider 子模块均为空。本次变更将实现第一个正式 Provider——通义百炼（Qwen/DashScope），并同步搭建可复用的 Provider 基础设施。

**现状**：
- `index.ts` 注册单个占位 Provider
- `src/provider.ts` 包含完整但无实际功能的占位实现（指向 `example.com`）
- `openclaw.plugin.json` 仅定义通用 `webSearch` 配置，无特定 Provider 配置

**参考实现**：
- 主仓库 `extensions/openai-search/` 的 `openai-search-web-search-provider.ts` 已通过 OpenAI 兼容协议实现了基础的 DashScope 搜索，但未利用 DashScope 的高级搜索参数（`search_options`），且无法获取搜索来源信息

**约束**：
- 仅允许通过 `openclaw/plugin-sdk/*` 公开路径接入 SDK
- HTTP 必须走 `withTrustedWebSearchEndpoint`
- 外部内容必须经 `wrapWebContent()` 包裹
- API key 禁止出现在缓存 key 和错误信息中

## Goals / Non-Goals

**Goals：**
- 实现功能完整的通义百炼搜索 Provider，**使用 DashScope 原生协议**，充分利用全部高级搜索能力
- 抽取可复用的共享基础设施，使后续 Provider（豆包、秘塔、智普）可在 30 分钟内完成骨架搭建
- 完整支持 `openclaw doctor` 和配置向导（通过标准 `WebSearchProviderPlugin` 接口）
- 通过单元测试覆盖所有关键路径

**Non-Goals：**
- 本次不实现其他 Provider（豆包、秘塔、智普）
- 不实现 Responses API 方式的搜索（该 API 仅支持少数模型，且仍处于早期阶段）
- 不实现流式搜索（streaming）
- 不实现图文混合输出（`enable_text_image_mixed`）
- 不实现 `agent_max` 搜索策略（含网页抓取，单独收费，且仅限 qwen3-max 思考模式）

## Decisions

### 决策 1：使用 DashScope 原生协议（而非 OpenAI 兼容协议）

**选择**：通过 `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation` 调用 DashScope 原生协议

**理由**：

1. **功能完整性**：DashScope 原生协议支持全部搜索能力。OpenAI 兼容协议**不支持**以下三项关键功能：
   - **返回搜索来源**（`search_info.search_results`）：包含结构化的搜索结果列表（URL、标题、站点名），可直接作为高质量 `citations`
   - **角标引用标注**（`enable_citation`）：回复内容中自动插入 `[1]` 等角标，提升可追溯性
   - **提前返回搜索来源**（`prepend_search_result`）：在流式场景中可降低首包延时

   对比 OpenAI 兼容协议，原生协议能获取到结构化的搜索来源数据，避免从回复文本中用正则"猜"URL，`citations` 质量大幅提升。

2. **技术可行性**：`withTrustedWebSearchEndpoint` 函数签名为 `(params: { url, timeoutSeconds, init: RequestInit }, run: (response: Response) => Promise<T>)`，对 URL、method、headers、body 和响应解析回调**无任何结构性限制**。DashScope 原生端点可直接作为 `url` 传入，自定义请求体和响应解析逻辑即可。

3. **差异化定位**：主仓库的 `openai-search` 已走 OpenAI 兼容协议；本独立插件走原生协议才能体现价值——提供 `openai-search` 不具备的搜索来源返回和角标标注能力。

4. **实现复杂度可控**：与 OpenAI 兼容协议相比，仅需调整请求/响应的 JSON 序列化/反序列化结构。请求体从 `{ model, messages, enable_search }` 变为 `{ model, input: { messages }, parameters: { enable_search, result_format, search_options } }`；响应从 `data.choices[0].message.content` 变为 `data.output.choices[0].message.content`，额外获得 `data.output.search_info`。核心逻辑（凭据、缓存、错误处理）完全不变。

**弃选方案**：使用 OpenAI 兼容协议 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- 优势：请求/响应与 OpenAI 一致，代码更少
- 劣势：**丧失搜索来源返回**（唯有 DashScope 原生协议支持 `search_info`），citations 只能靠正则从文本中猜测 URL，不可靠
- 结论：拒绝。作为通义百炼专用插件，不应牺牲原生协议独有的核心搜索能力

### 决策 2：Provider 目录结构与共享基础设施分层

**选择**：采用 `src/providers/shared/` + `src/providers/qwen/` 的分层结构

```
src/
  providers/
    shared/
      config.ts       ← 通用配置解析（scoped config 读取、凭据解析链）
      errors.ts        ← 标准化错误返回构建器
      schema.ts        ← Tool Schema 构建器
      types.ts         ← 共享类型定义
    qwen/
      qwen-provider.ts ← 通义百炼 Provider 实现
      qwen.test.ts     ← 单元测试
  provider.ts          ← 重构为 Provider 注册中心（导出所有 Provider）
```

**理由**：
- 后续新增 Provider 只需创建 `src/providers/{name}/` 目录并实现 Provider 函数，无需修改共享代码
- 共享模块封装通用逻辑（凭据解析链、错误构建、缓存包装），避免各 Provider 间的代码重复
- 测试代码与实现代码同目录，符合项目规范

**替代方案**：所有 Provider 放在同一文件中
- 劣势：文件过长，不同 Provider 的修改产生冲突
- 结论：拒绝

### 决策 3：配置键设计——`qwen` 作为 scoped key

**选择**：在 `plugins.entries.openclaw-web-search.config` 下使用 `qwen` 作为 Provider 级配置键

```json
{
  "plugins": {
    "entries": {
      "openclaw-web-search": {
        "config": {
          "qwen": {
            "apiKey": "sk-...",
            "model": "qwen-plus",
            "searchStrategy": "turbo",
            "forcedSearch": false,
            "enableThinking": false,
            "enableSearchExtension": false,
            "enableSource": true,
            "enableCitation": false,
            "citationFormat": "[<number>]",
            "freshness": null,
            "timeoutSeconds": 30
          }
        }
      }
    }
  }
}
```

同时在 `tools.web.search.qwen.*` 保持旧式配置路径的向后兼容读取。

**理由**：
- 与 AGENTS.md 中定义的配置键约定一致（`qwen` 作为 scoped key）
- 每个 Provider 独立的配置子树，避免配置冲突
- 支持 `readConfiguredSecretString` + `readProviderEnvValue` 双路径凭据解析
- 相比上一版新增 `enableSource`、`enableCitation`、`citationFormat` 配置项，对应原生协议独有能力
- 移除了 `baseUrl` 配置项——DashScope 原生协议的端点固定为 `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`，无需用户配置

### 决策 4：凭据解析优先级

**选择**：
1. `plugins.entries.openclaw-web-search.config.qwen.apiKey`（插件配置）
2. `tools.web.search.qwen.apiKey`（旧式配置，向后兼容）
3. `DASHSCOPE_API_KEY` 环境变量

**理由**：
- 与 AGENTS.md 中定义的凭据优先级一致
- 环境变量使用 `DASHSCOPE_API_KEY`，与通义百炼官方文档和 `openai-search` 插件保持一致
- 旧式配置路径确保从 `openai-search` 迁移的用户无需修改现有配置

### 决策 5：与 `openai-search` 内置插件的共存策略

**选择**：两个插件可以共存，由用户通过配置选择使用哪一个

**理由**：
- `openai-search` 是通用的 OpenAI 兼容搜索（也支持 DashScope），定位为基础能力
- `openclaw-web-search` 的通义百炼 Provider 使用 DashScope 原生协议，提供搜索来源返回、角标标注等独有高级能力
- 两者使用相同的环境变量 `DASHSCOPE_API_KEY`，用户无需重复配置凭据
- OpenClaw 的 `autoDetectOrder` 机制可自动选择，本插件的 qwen Provider 使用 `autoDetectOrder: 50`（高于 `openai-search` 的 55），使其在同时启用时优先被选中

### 决策 6：DashScope 原生协议的请求/响应结构

**选择**：按照 DashScope 原生 API 格式构建请求和解析响应

**请求体结构**：
```typescript
const body = {
  model,
  input: {
    messages: [{ role: "user", content: query }],
  },
  parameters: {
    enable_search: true,
    result_format: "message",
    search_options: {
      // 可选高级参数
      search_strategy: searchStrategy,     // "turbo" | "max" | "agent"
      forced_search: forcedSearch,          // boolean
      enable_search_extension: enableSearchExtension,  // boolean
      freshness: freshness,                // 7 | 30 | 180 | 365
      enable_source: enableSource,         // boolean
      enable_citation: enableCitation,     // boolean
      citation_format: citationFormat,     // "[<number>]" | "[ref_<number>]"
      assigned_site_list: assignedSiteList, // string[]
      intention_options: intentionOptions,  // { prompt_intervene: string }
    },
    enable_thinking: enableThinking,       // boolean
  },
};
```

**响应解析路径**：
- 回复内容：`data.output.choices[0].message.content`
- 搜索来源（citations 主要来源）：`data.output.search_info.search_results[].url`
- 搜索来源标题：`data.output.search_info.search_results[].title`
- 垂域搜索结果：`data.output.search_info.extra_tool_info[].result`
- Token 用量：`data.usage`
- 请求 ID：`data.request_id`
- 搜索计数：`data.usage.plugins.search.count`

**理由**：
- DashScope 原生协议使用 `input` + `parameters` 的二层结构，将消息列表和模型参数分离，结构清晰
- `parameters.result_format` 必须设为 `"message"` 以获得标准的 `choices[].message` 响应格式
- `search_info` 中的结构化搜索来源可直接转换为高质量 `citations`——URL 和标题均可获取，无需从文本正则匹配
- 响应中的 `usage.plugins.search.count` 可用于日志/诊断，确认搜索是否实际执行

### 决策 7：Citations 提取策略——结构化来源优先

**选择**：优先使用 `search_info.search_results` 中的结构化 URL 作为 citations，同时保留正则匹配作为 fallback

```typescript
function extractCitations(data: DashScopeResponse): string[] {
  const urls = new Set<string>();
  // 优先：从 search_info.search_results 提取结构化 URL
  const searchResults = data.output?.search_info?.search_results;
  if (searchResults?.length) {
    for (const result of searchResults) {
      if (result.url) urls.add(result.url);
    }
  }
  // Fallback：从回复内容中正则匹配 URL（兼容 search_info 缺失的情况）
  const content = data.output?.choices?.[0]?.message?.content;
  if (content) {
    const urlPattern = /https?:\/\/[^\s)<>\]"']+/g;
    for (const match of content.matchAll(urlPattern)) {
      urls.add(match[0]);
    }
  }
  return [...urls];
}
```

**理由**：
- 结构化来源的 URL 更完整、更准确（由 DashScope 搜索引擎直接提供）
- 正则匹配作为 fallback 保证在 `enable_source: false` 或响应异常时仍能提取部分 citations
- 两种方式合并去重，最大化 citations 覆盖

## Risks / Trade-offs

**[已消除] 原 OpenAI 兼容协议无法返回搜索来源** → 改用 DashScope 原生协议后，可通过 `search_info.search_results` 直接获取结构化搜索来源信息，citations 质量大幅提升。

**[风险] 与 `openai-search` 的环境变量冲突** → 两者共用 `DASHSCOPE_API_KEY`，不会冲突；但当两个插件都启用且均有 key 时，由 `autoDetectOrder` 决定优先级，需要在文档中明确说明。

**[风险] DashScope API 的请求频率限制（15 RPS）** → 通过 OpenClaw 的搜索缓存机制（`buildSearchCacheKey` / `readCachedSearchPayload`）减少重复请求；缓存 key 基于 query + 搜索参数组合（不含 API key）。

**[风险] 共享基础设施过度抽象** → 只抽取确定会被多 Provider 共用的逻辑（凭据解析链、错误构建器、Tool Schema 构建器），不做预测性抽象；保持各 Provider 的 `execute` 主流程自包含。

**[风险] DashScope 原生协议与 OpenAI 兼容协议的请求/响应结构不同** → 实现复杂度增量有限——仅需调整请求体的 `input`/`parameters` 包裹和响应的 `output` 解包。通过定义清晰的 TypeScript 类型（`DashScopeRequest`、`DashScopeResponse`）确保类型安全。

**[权衡] 无法自定义 baseUrl** → DashScope 原生协议的端点固定，不像 OpenAI 兼容协议可以指向任意代理。如果用户需要代理，可在网络层（HTTP_PROXY 等）处理。这是可接受的权衡，因为原生协议的功能增益远大于代理灵活性的损失。

**[权衡] 不支持 Responses API** → Responses API 仅支持极少数模型（qwen3.5、qwen3-max），且需要不同的请求结构；暂不值得投入。

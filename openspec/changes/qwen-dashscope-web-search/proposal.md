## Why

OpenClaw 当前的联网搜索能力依赖主仓库内置的 `openai-search` 插件（位于 `extensions/openai-search/`），该插件通过 OpenAI 兼容的 Chat Completions API + `enable_search` 参数实现通义百炼/DashScope 搜索。然而，这种方式存在以下局限：

1. **功能受限**：OpenAI 兼容协议**不支持**通义百炼的三项关键能力——返回搜索来源信息（`search_info`）、角标引用标注（`enable_citation`）、提前返回搜索来源。现有插件只能通过正则从回复文本中猜测 URL 作为 citations，质量不可靠。
2. **高级搜索参数未利用**：虽然 OpenAI 兼容协议也支持 `search_options`（强制搜索、搜索策略、垂域搜索、时效性等），但 `openai-search` 插件未实现这些参数。
3. **缺乏独立扩展性**：内置插件无法被外部独立迭代；本项目 `openclaw-web-search` 定位为独立外部插件，需要建立自己的通义百炼 Provider，通过 DashScope 原生协议充分利用全部搜索能力。
4. **首个 Provider 基础设施缺失**：当前插件骨架（`src/provider.ts`）仅有占位实现，缺少可复用的 Provider 基础设施（通用配置解析、请求/响应管道、错误归一化等），不利于后续快速接入其他搜索提供商。

作为 `openclaw-web-search` 的第一个正式 Provider，通义百炼（Qwen/DashScope）的接入将同时完成基础设施搭建，为豆包、秘塔、智普等后续提供商铺平道路。

## What Changes

- **新增通义百炼搜索 Provider**（`src/providers/qwen/`）：
  - 通过 **DashScope 原生协议**（`https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`）实现联网搜索，获取全部搜索能力
  - 支持 `enable_search`、`search_options`（含 `forced_search`、`search_strategy`、`enable_search_extension`、`freshness`、`enable_source`、`enable_citation`、`citation_format`、`assigned_site_list`、`intention_options`）等高级搜索参数
  - 支持的模型：`qwen-plus`（默认）、`qwen3-max`、`qwen3.5-plus`、`qwen3.5-flash`、`qwen-turbo`、`qwq-plus`、`deepseek-r1`、`deepseek-v3` 等通义百炼平台支持联网搜索的模型
  - 响应归一化：从 DashScope 原生响应中提取 `output.choices[0].message.content` 作为内容；**优先使用** `output.search_info.search_results[].url` 作为结构化 `citations`，正则匹配 URL 作为 fallback
  - 支持 `enable_thinking`（深度思考模式）
  - 支持搜索来源角标标注（`enable_citation` + `citation_format`）

- **抽取可复用的 Provider 基础设施**（`src/providers/shared/`）：
  - 通用配置解析工具（scoped config 读取、凭据解析链）
  - 通用 HTTP 请求/响应管道（错误归一化、超时处理）
  - 通用缓存辅助函数包装
  - 通用 Tool Schema 构建器（`query` + 可选参数）
  - 标准化错误返回构建器

- **重构插件入口和注册逻辑**（`index.ts`、`src/provider.ts`）：
  - 将占位实现替换为真实的通义百炼 Provider 注册
  - 支持多 Provider 注册模式（为后续提供商预留）

- **更新 `openclaw.plugin.json`**：
  - `configSchema` 新增 `qwen` 子项，支持 `apiKey`、`model`、`searchStrategy`、`forcedSearch`、`enableThinking`、`enableSearchExtension`、`enableSource`、`enableCitation`、`citationFormat`、`freshness`、`timeoutSeconds` 等配置字段
  - `uiHints` 新增通义百炼相关配置项的中文标签和帮助文本
  - `providerAuthEnvVars` 新增 `DASHSCOPE_API_KEY` 映射

- **新增单元测试**（`src/providers/qwen/qwen.test.ts`）：
  - 覆盖凭据缺失、空 query、请求体序列化（验证 DashScope 原生格式）、正常响应归一化（含 search_info 解析）、缓存命中、非 2xx 错误、高级搜索参数传递等场景

- **支持 `openclaw doctor` 和配置向导**：
  - Provider 注册时提供完整的凭据路径和 UI hints，使 `openclaw doctor` 和 `openclaw onboard search` 能自动发现并引导用户配置通义百炼

## Capabilities

### New Capabilities

- `qwen-provider`：通义百炼（DashScope）搜索 Provider 的完整实现，使用 DashScope 原生协议，支持搜索来源返回、角标标注、高级搜索参数、深度思考模式
- `provider-shared-infra`：可复用的 Provider 基础设施层，包含通用配置解析、错误归一化、缓存包装、Tool Schema 构建器等共享模块

### Modified Capabilities

（无已有 Spec 需要修改）

## Impact

**代码影响**：
- 新增 `src/providers/qwen/` 目录（Provider 实现 + 测试）
- 新增 `src/providers/shared/` 目录（共享基础设施）
- 重构 `src/provider.ts`（从占位实现改为注册中心）
- 更新 `index.ts`（多 Provider 注册）
- 更新 `openclaw.plugin.json`（configSchema + uiHints + providerAuthEnvVars）

**API/配置影响**：
- 新增配置路径 `plugins.entries.openclaw-web-search.config.qwen.*`
- 新增环境变量支持 `DASHSCOPE_API_KEY`
- 新增搜索配置 scoped key `qwen`

**依赖影响**：
- 无新增外部依赖（继续使用 `@sinclair/typebox` 和 `openclaw/plugin-sdk/*`）

**兼容性**：
- 现有 `openai-search` 内置插件不受影响，两者可并存
- 本插件使用 DashScope 原生协议，`openai-search` 使用 OpenAI 兼容协议——功能互补，用户可按需选择
- 用户可通过 `openclaw plugins install` 安装本插件后，在配置中选择使用通义百炼 Provider

**安全边界**：
- API key 不纳入缓存 key、不写入错误信息
- 仅发送 `query` 给外部搜索 API，不发送用户上下文
- 搜索结果必须经 `wrapWebContent()` 包裹后返回

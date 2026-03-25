## 1. 共享基础设施搭建

- [x] 1.1 [shared] 创建 `src/providers/shared/types.ts`——定义 `ProviderConfig`（含 `apiKey`、`timeoutSeconds`）、`SearchToolResult`、`SearchToolError`、`DashScopeResponse`（含 `output`、`usage`、`request_id`）、`DashScopeSearchInfo`（含 `search_results`、`extra_tool_info`）、`DashScopeSearchResult`（含 `index`、`title`、`url`、`site_name`、`icon`）等共享类型
- [x] 1.2 [shared] 创建 `src/providers/shared/config.ts`——实现 `resolveCredential` 通用凭据解析链（插件配置 → 旧式配置 → 环境变量），实现 `resolveProviderConfig` 配置合并读取工具
- [x] 1.3 [shared] 创建 `src/providers/shared/errors.ts`——实现 `buildMissingKeyError`、`buildApiError`、`buildDashScopeApiError` 标准化错误返回构建器（确保不泄露 API Key；`buildDashScopeApiError` 专门解析 DashScope 原生协议的 `{ code, message, request_id }` 错误格式）
- [x] 1.4 [shared] 创建 `src/providers/shared/schema.ts`——实现 `buildSearchToolSchema` 基础搜索 Tool Schema 构建器（含必需的 `query` 参数）
- [x] 1.5 [shared] 创建 `src/providers/shared/index.ts`——统一导出共享模块的公开 API

## 2. 通义百炼 Provider 实现（DashScope 原生协议）

- [x] 2.1 [qwen] 创建 `src/providers/qwen/qwen-provider.ts`——实现 `createQwenDashScopeProvider` 函数，包含完整的 `WebSearchProviderPlugin` 接口实现
- [x] 2.2 [qwen] 实现凭据解析——按优先级链读取 API Key（插件配置 → 旧式搜索配置 `tools.web.search.qwen.apiKey` → 环境变量 `DASHSCOPE_API_KEY`）
- [x] 2.3 [qwen] 实现搜索请求构建——向 DashScope **原生协议** 端点 `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation` 发送请求，使用 `input` + `parameters` 二层结构，`parameters.result_format` 固定为 `"message"`；支持 `parameters.search_options`（含 `search_strategy`、`forced_search`、`enable_search_extension`、`freshness`、`enable_source`、`enable_citation`、`citation_format`、`assigned_site_list`、`intention_options`）和 `parameters.enable_thinking`
- [x] 2.4 [qwen] 实现响应归一化——从 `data.output.choices[0].message.content` 提取回复内容；**优先**从 `data.output.search_info.search_results[].url` 提取结构化 citations（DashScope 原生协议独有），正则匹配 URL 作为 fallback；两种来源合并去重；使用 `wrapWebContent()` 包裹内容
- [x] 2.5 [qwen] 实现搜索缓存——使用 `buildSearchCacheKey` 构建缓存 key（包含 query、model、searchStrategy、forcedSearch、enableThinking、enableSearchExtension、freshness、enableSource、enableCitation，不含 API Key），调用 `readCachedSearchPayload` / `writeCachedSearchPayload`
- [x] 2.6 [qwen] 实现错误处理——凭据缺失返回结构化错误；非 2xx 响应使用 `buildDashScopeApiError` 解析 DashScope 原生错误格式（`{ code, message, request_id }`），回退到通用错误处理；不泄露 API Key

## 3. 插件入口与注册

- [x] 3.1 [provider] 重构 `src/provider.ts`——从占位实现改为 Provider 注册中心模式，导出 `getAllProviders()` 函数返回 Provider 数组
- [x] 3.2 [index] 更新 `index.ts`——从单一 Provider 注册改为遍历 `getAllProviders()` 逐个注册
- [x] 3.3 [plugin] 更新 `openclaw.plugin.json`——在 `configSchema` 新增 `qwen` 配置子项（`apiKey`、`model`、`searchStrategy`、`forcedSearch`、`enableThinking`、`enableSearchExtension`、`enableSource`、`enableCitation`、`citationFormat`、`freshness`、`timeoutSeconds`），在 `uiHints` 新增中文标签和帮助文本，在 `providerAuthEnvVars` 新增 `"qwen-dashscope": ["DASHSCOPE_API_KEY"]`

## 4. 单元测试

- [x] 4.1 [shared/test] 创建共享模块测试——测试 `resolveCredential` 的三级解析逻辑、`buildMissingKeyError`/`buildApiError`/`buildDashScopeApiError` 的输出格式、`buildSearchToolSchema` 的 Schema 结构
- [x] 4.2 [qwen/test] 创建 `src/providers/qwen/qwen.test.ts`——测试凭据缺失时返回结构化错误（不抛出异常）
- [x] 4.3 [qwen/test] 测试 `query` 参数为空或非字符串时的错误处理
- [x] 4.4 [qwen/test] 测试请求体序列化——验证 DashScope 原生协议格式（`input.messages` 包裹、`parameters.enable_search`、`parameters.result_format: "message"`、`parameters.search_options`、`parameters.enable_thinking` 等参数正确传递）
- [x] 4.5 [qwen/test] 测试正常响应归一化——验证从 `output.choices[0].message.content` 提取内容、从 `output.search_info.search_results[].url` 提取结构化 citations、正则匹配 URL fallback、`wrapWebContent()` 包裹
- [x] 4.6 [qwen/test] 测试缓存命中路径——验证相同参数返回缓存内容、不同搜索参数分别缓存
- [x] 4.7 [qwen/test] 测试非 2xx 响应——验证 DashScope 原生错误格式解析（`{ code, message, request_id }`）、通用错误 fallback、且不包含 API Key
- [x] 4.8 [qwen/test] 测试搜索来源缺失时的 fallback——验证 `search_info` 缺失或为空时回退到正则匹配

## 5. 集成验证与文档

- [x] 5.1 [验证] 运行 `npm run check` 确保 TypeScript 类型检查通过
- [ ] 5.2 [验证] 通过 `openclaw plugins install -l` 本地安装插件，验证 Provider 注册和 `openclaw doctor` 可发现 `qwen-dashscope`（需要 OpenClaw Gateway 运行环境）
- [x] 5.3 [文档] 更新 `README.md`——新增通义百炼 Provider 的配置说明（DashScope 原生协议、搜索来源返回、角标标注等特色能力）、支持模型列表、环境变量说明、与 `openai-search` 的差异对比
- [x] 5.4 [文档] 更新 `AGENTS.md`——同步新增的目录结构和配置键约定

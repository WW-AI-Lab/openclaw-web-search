## ADDED Requirements

### Requirement: 通义百炼 Provider 注册

系统 SHALL 注册一个 id 为 `qwen-dashscope` 的 `WebSearchProviderPlugin`，通过 `openclaw/plugin-sdk/provider-web-search` 的标准接口实现。

Provider 的元信息 SHALL 包含：
- `id`: `"qwen-dashscope"`
- `label`: `"通义百炼搜索 (DashScope)"`
- `hint`: `"通过阿里云百炼平台 DashScope 原生协议实现联网搜索，支持搜索来源返回与角标标注"`
- `envVars`: `["DASHSCOPE_API_KEY"]`
- `placeholder`: `"sk-..."`
- `signupUrl`: `"https://dashscope.aliyun.com/"`
- `docsUrl`: `"https://help.aliyun.com/zh/model-studio/web-search"`
- `autoDetectOrder`: `50`
- `credentialPath`: `"plugins.entries.openclaw-web-search.config.qwen.apiKey"`

#### Scenario: 插件加载时注册 Provider

- **WHEN** OpenClaw 加载 `openclaw-web-search` 插件
- **THEN** 系统 SHALL 注册 `qwen-dashscope` 作为可用的 web search provider
- **THEN** `openclaw doctor` 和 `openclaw onboard search` SHALL 能发现并列出该 Provider

#### Scenario: autoDetectOrder 优先级

- **WHEN** 用户同时启用了 `openclaw-web-search`（qwen-dashscope，order=50）和 `openai-search`（order=55），且均配有 `DASHSCOPE_API_KEY`
- **THEN** 系统 SHALL 优先选择 `qwen-dashscope` Provider（order 值更小 = 更优先）

---

### Requirement: 凭据解析

系统 SHALL 按以下优先级解析通义百炼 API Key：

1. 插件配置：`plugins.entries.openclaw-web-search.config.qwen.apiKey`
2. 旧式搜索配置：`tools.web.search.qwen.apiKey`
3. 环境变量：`DASHSCOPE_API_KEY`

凭据解析 SHALL 使用 SDK 提供的 `readConfiguredSecretString` 和 `readProviderEnvValue` 函数。

#### Scenario: 从插件配置读取 API Key

- **WHEN** 用户在 `plugins.entries.openclaw-web-search.config.qwen.apiKey` 设置了值
- **THEN** 系统 SHALL 使用该值作为 API Key，忽略环境变量

#### Scenario: 从环境变量读取 API Key

- **WHEN** 插件配置和旧式配置中均未设置 API Key
- **WHEN** 环境变量 `DASHSCOPE_API_KEY` 已设置
- **THEN** 系统 SHALL 使用环境变量的值作为 API Key

#### Scenario: 缺少 API Key 时返回结构化错误

- **WHEN** 所有凭据来源均无有效的 API Key
- **THEN** 系统 SHALL 返回结构化错误对象（不抛出异常）
- **THEN** 错误对象 SHALL 包含 `error: "missing_qwen_dashscope_api_key"` 和中文 `message` 指引用户如何配置

---

### Requirement: 搜索请求构建（DashScope 原生协议）

系统 SHALL 向 DashScope 原生 API 发送搜索请求：
- 端点：`https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
- 认证方式：`Authorization: Bearer <apiKey>`
- 请求方法：POST，`Content-Type: application/json`

请求体 SHALL 使用 DashScope 原生协议格式——`input` + `parameters` 二层结构：
```json
{
  "model": "<配置的模型或默认 qwen-plus>",
  "input": {
    "messages": [{ "role": "user", "content": "<用户查询>" }]
  },
  "parameters": {
    "enable_search": true,
    "result_format": "message",
    "search_options": {}
  }
}
```

`parameters.result_format` SHALL 始终设为 `"message"`，以获得标准的 `choices[].message` 响应格式。

系统 SHALL 支持以下可选高级搜索参数，通过 `parameters.search_options` 传递：
- `search_strategy`：搜索量级策略，可选 `"turbo"`（默认）、`"max"`、`"agent"`
- `forced_search`：是否强制搜索，布尔值，默认 `false`
- `enable_search_extension`：是否开启垂域搜索，布尔值，默认 `false`
- `freshness`：搜索时效性，可选 `7`、`30`、`180`、`365`，默认不限制
- `enable_source`：是否返回搜索来源，布尔值，默认 `true`
- `enable_citation`：是否启用角标标注，布尔值，默认 `false`（需 `enable_source: true` 前提下生效）
- `citation_format`：角标格式，可选 `"[<number>]"`（默认）或 `"[ref_<number>]"`
- `assigned_site_list`：限定搜索来源站点列表，字符串数组，最多 25 个站点
- `intention_options.prompt_intervene`：自然语言控制检索范围

系统 SHALL 支持深度思考模式：
- 当配置 `enableThinking: true` 时，`parameters` SHALL 包含 `"enable_thinking": true`

HTTP 请求 SHALL 通过 `withTrustedWebSearchEndpoint` 发送，不得裸用 `fetch`。

#### Scenario: 基本搜索请求（DashScope 原生格式）

- **WHEN** 用户发起查询 `"杭州天气"`，使用默认配置
- **THEN** 系统 SHALL 向 `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation` 发送 POST 请求
- **THEN** 请求体 SHALL 使用 `input.messages` 包裹查询消息
- **THEN** 请求体 SHALL 包含 `parameters.enable_search: true` 和 `parameters.result_format: "message"`

#### Scenario: 高级搜索参数传递

- **WHEN** 配置了 `searchStrategy: "max"` 和 `forcedSearch: true`
- **THEN** `parameters.search_options` SHALL 包含 `search_strategy: "max"` 和 `forced_search: true`

#### Scenario: 搜索来源返回（DashScope 原生协议独有能力）

- **WHEN** 配置了 `enableSource: true`（默认值）
- **THEN** `parameters.search_options` SHALL 包含 `enable_source: true`
- **THEN** DashScope 响应 SHALL 包含 `output.search_info.search_results` 结构化搜索来源

#### Scenario: 角标标注启用

- **WHEN** 配置了 `enableCitation: true`
- **THEN** `parameters.search_options` SHALL 包含 `enable_citation: true` 和 `citation_format`
- **THEN** 回复内容中 SHALL 包含类似 `[1]` 或 `[ref_1]` 的角标

#### Scenario: 深度思考模式

- **WHEN** 配置了 `enableThinking: true`
- **THEN** `parameters` SHALL 包含 `enable_thinking: true`

#### Scenario: 仅发送 query 到外部 API

- **WHEN** 发起搜索请求
- **THEN** 系统 SHALL 仅将用户的搜索 query 发送给 DashScope API
- **THEN** 系统 SHALL 不发送任何用户上下文、会话历史或系统提示

#### Scenario: 限定搜索来源站点

- **WHEN** 配置了 `assignedSiteList: ["baidu.com", "sina.cn"]`
- **THEN** `parameters.search_options` SHALL 包含 `assigned_site_list: ["baidu.com", "sina.cn"]`
- **THEN** 搜索 SHALL 严格限于指定站点

---

### Requirement: 响应归一化（DashScope 原生协议格式）

系统 SHALL 将 DashScope 原生协议响应归一化为标准工具返回结构：

```typescript
{
  query: string;           // 原始查询
  provider: "qwen-dashscope";
  model: string;           // 使用的模型名
  tookMs: number;          // 请求耗时（毫秒）
  externalContent: {
    untrusted: true,
    source: "web_search",
    provider: "qwen-dashscope",
    wrapped: true
  };
  content: string;         // 经 wrapWebContent() 包裹的回复内容
  citations: string[];     // 搜索来源 URL 列表
}
```

回复内容 SHALL 从 `data.output.choices[0].message.content` 提取。

Citations 提取 SHALL 采用**结构化来源优先**策略：
1. 优先从 `data.output.search_info.search_results[].url` 提取结构化 URL
2. 作为 fallback，从回复内容中正则匹配 URL（去重）
3. 两种来源合并去重

内容 SHALL 经 `wrapWebContent()` 包裹后返回。

#### Scenario: 正常响应归一化（含搜索来源）

- **WHEN** DashScope 返回包含回复内容和 `search_info.search_results` 的响应
- **THEN** 系统 SHALL 将 `output.choices[0].message.content` 提取为 `content`
- **THEN** 系统 SHALL 优先使用 `search_info.search_results[].url` 作为 `citations`
- **THEN** `content` SHALL 经 `wrapWebContent()` 包裹

#### Scenario: 搜索来源缺失时的 fallback

- **WHEN** DashScope 响应中 `search_info` 缺失或 `search_results` 为空
- **THEN** 系统 SHALL 回退到从回复内容中正则匹配 URL 作为 `citations`

#### Scenario: 空回复处理

- **WHEN** DashScope 返回 `output.choices[0].message.content` 为 `null` 或空字符串
- **THEN** 系统 SHALL 使用 `"未返回搜索结果。"` 作为 `content`

#### Scenario: 深度思考模式的响应处理

- **WHEN** 启用了深度思考模式
- **WHEN** 响应中包含 `reasoning_content` 字段
- **THEN** 系统 SHALL 仅使用 `content` 字段作为最终回复，`reasoning_content` 不纳入返回结果

#### Scenario: 垂域搜索结果处理

- **WHEN** 启用了垂域搜索（`enable_search_extension: true`）
- **WHEN** 响应 `search_info.extra_tool_info` 包含垂域搜索数据
- **THEN** 系统 SHALL 在日志中记录垂域搜索结果（用于诊断），但不直接拼入 `content`

---

### Requirement: 搜索结果缓存

系统 SHALL 对搜索结果实施缓存，避免重复请求。

缓存 key SHALL 通过 `buildSearchCacheKey` 构建，包含以下因子：
- Provider ID（`"qwen-dashscope"`）
- 查询文本（`query`）
- 模型名称（`model`）
- 搜索策略（`searchStrategy`）
- 是否强制搜索（`forcedSearch`）
- 是否启用深度思考（`enableThinking`）
- 是否启用垂域搜索（`enableSearchExtension`）
- 搜索时效性（`freshness`）
- 是否返回搜索来源（`enableSource`）
- 是否启用角标标注（`enableCitation`）

缓存 key SHALL 不包含 API Key。

#### Scenario: 缓存命中

- **WHEN** 发起搜索且缓存中存在相同 key 的结果
- **THEN** 系统 SHALL 直接返回缓存内容，不发起 HTTP 请求

#### Scenario: 缓存未命中

- **WHEN** 发起搜索且缓存中无匹配结果
- **THEN** 系统 SHALL 发起 HTTP 请求
- **THEN** 系统 SHALL 将结果写入缓存

#### Scenario: 相同查询不同搜索参数

- **WHEN** 同一 query 分别使用 `searchStrategy: "turbo"` 和 `searchStrategy: "max"`
- **THEN** 系统 SHALL 视为两个不同的缓存 key，分别缓存

---

### Requirement: 错误处理

系统 SHALL 对所有错误情况返回结构化错误对象，不抛出异常。

#### Scenario: 非 2xx 响应

- **WHEN** DashScope API 返回非 2xx 状态码（如 401、429、500）
- **THEN** 系统 SHALL 返回包含 `error` 字段的对象
- **THEN** 错误信息 SHALL 包含 HTTP 状态码和响应体摘要
- **THEN** 错误信息 SHALL 不包含 API Key

#### Scenario: DashScope 原生协议错误响应解析

- **WHEN** DashScope 返回错误响应（如 `{"code": "InvalidApiKey", "message": "..."}` 格式）
- **THEN** 系统 SHALL 尝试解析 DashScope 原生错误格式，提取 `code` 和 `message` 字段
- **THEN** 如果无法解析，SHALL 回退到使用 HTTP 状态码和原始响应文本

#### Scenario: query 参数缺失

- **WHEN** 工具调用时 `query` 参数为空字符串或未提供
- **THEN** 系统 SHALL 通过 `readStringParam` 的 `required: true` 抛出参数校验错误

#### Scenario: 网络超时

- **WHEN** 请求超过配置的超时时间（默认 30 秒）
- **THEN** `withTrustedWebSearchEndpoint` SHALL 处理超时并返回错误

---

### Requirement: 支持的模型列表

Provider SHALL 默认使用 `qwen-plus` 模型。

用户 SHALL 可通过配置 `model` 参数切换至以下支持联网搜索的模型：

**中国内地**：
- **千问 Max 系列**：`qwen3-max`、`qwen3-max-preview`、`qwen3-max-2025-09-23`、`qwen3-max-2026-01-23`、`qwen-max`、`qwen-max-latest`
- **千问 Plus 系列**：`qwen3.5-plus`、`qwen3.5-plus-2026-02-15`、`qwen-plus`、`qwen-plus-latest`
- **千问 Flash 系列**：`qwen3.5-flash`、`qwen3.5-flash-2026-02-23`、`qwen-flash`
- **千问 Turbo 系列**：`qwen-turbo`、`qwen-turbo-latest`、`qwen-turbo-2025-07-15`
- **推理系列**：`qwq-plus`
- **第三方模型**：`deepseek-v3.2`、`deepseek-v3.2-exp`、`deepseek-v3.1`、`deepseek-r1-0528`、`deepseek-r1`、`deepseek-v3`、`Moonshot-Kimi-K2-Instruct`、`MiniMax-M2.1`

系统 SHALL 不对模型名称做强校验（允许用户使用未列出的模型名），以兼容 DashScope 平台未来新增的模型。

#### Scenario: 使用默认模型

- **WHEN** 未配置 `model` 参数
- **THEN** 系统 SHALL 使用 `"qwen-plus"` 作为默认模型

#### Scenario: 切换至指定模型

- **WHEN** 配置 `model: "qwen3-max"`
- **THEN** 系统 SHALL 在请求体中使用 `"model": "qwen3-max"`

---

### Requirement: 配置项定义

`openclaw.plugin.json` 的 `configSchema` SHALL 新增 `qwen` 配置子项：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `apiKey` | `string \| object` | — | DashScope API Key（支持 secret ref） |
| `model` | `string` | `qwen-plus` | 搜索模型 |
| `searchStrategy` | `string` | `turbo` | 搜索量级策略（`turbo`/`max`/`agent`） |
| `forcedSearch` | `boolean` | `false` | 是否强制搜索 |
| `enableThinking` | `boolean` | `false` | 是否启用深度思考 |
| `enableSearchExtension` | `boolean` | `false` | 是否启用垂域搜索 |
| `enableSource` | `boolean` | `true` | 是否返回搜索来源（DashScope 原生协议独有） |
| `enableCitation` | `boolean` | `false` | 是否启用角标标注（需 enableSource 为 true） |
| `citationFormat` | `string` | `[<number>]` | 角标格式（`[<number>]` 或 `[ref_<number>]`） |
| `freshness` | `number` | — | 搜索时效性（7/30/180/365） |
| `timeoutSeconds` | `number` | `30` | 请求超时 |

`uiHints` SHALL 为每个配置项提供中文 `label` 和 `help` 文本。

`providerAuthEnvVars` SHALL 包含 `"qwen-dashscope": ["DASHSCOPE_API_KEY"]`。

#### Scenario: 配置向导展示

- **WHEN** 用户运行 `openclaw onboard search`
- **THEN** 系统 SHALL 展示 `"通义百炼搜索 (DashScope)"` 作为可选 Provider
- **THEN** 系统 SHALL 引导用户配置 API Key，placeholder 为 `"sk-..."`

#### Scenario: 安全配置

- **WHEN** `apiKey` 字段在配置中
- **THEN** UI SHALL 将其标记为 `sensitive: true`，不明文展示

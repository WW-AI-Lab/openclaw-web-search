## ADDED Requirements

### Requirement: 通用凭据解析链

共享模块 SHALL 提供 `resolveCredential` 工具函数，封装标准的三级凭据解析逻辑：

1. 插件配置（通过 `resolveProviderWebSearchPluginConfig`）
2. 旧式搜索配置（通过 `readConfiguredSecretString` 从 scoped config 读取）
3. 环境变量（通过 `readProviderEnvValue`）

函数签名 SHALL 接受：
- `pluginId`：插件 ID
- `scopeKey`：scoped config 的键名
- `envVars`：环境变量名数组
- 相关配置对象

返回 `string | undefined`。

#### Scenario: 三级凭据解析

- **WHEN** 调用 `resolveCredential` 且插件配置中有 apiKey
- **THEN** 系统 SHALL 返回插件配置中的 apiKey，不继续查找环境变量

#### Scenario: 回退到环境变量

- **WHEN** 插件配置和旧式配置均无 apiKey
- **THEN** 系统 SHALL 从指定的环境变量列表中查找并返回第一个有效值

#### Scenario: 所有来源均无凭据

- **WHEN** 所有凭据来源均无有效值
- **THEN** 系统 SHALL 返回 `undefined`

---

### Requirement: 标准化错误返回构建器

共享模块 SHALL 提供 `buildMissingKeyError` 工具函数，用于生成缺少 API Key 时的标准错误对象。

错误对象 SHALL 包含以下字段：
- `error`：错误标识符（格式：`"missing_{provider}_api_key"`）
- `message`：中文提示信息，指引用户如何配置凭据
- `docs`：可选的文档链接

共享模块 SHALL 提供 `buildApiError` 工具函数，用于生成 API 请求失败时的标准错误对象。

错误对象 SHALL 包含：
- `error`：错误标识符（格式：`"{provider}_api_error"`）
- `message`：包含 HTTP 状态码的错误描述（不含 API Key）
- `status`：HTTP 状态码

共享模块 SHALL 提供 `buildDashScopeApiError` 工具函数，用于解析 DashScope 原生协议的错误响应格式（`{ code, message, request_id }`），生成包含原始错误码的标准错误对象。

#### Scenario: 生成缺少凭据错误

- **WHEN** 调用 `buildMissingKeyError("qwen-dashscope", "DASHSCOPE_API_KEY", "plugins.entries.openclaw-web-search.config.qwen.apiKey")`
- **THEN** 系统 SHALL 返回包含 `error: "missing_qwen_dashscope_api_key"` 的对象
- **THEN** `message` SHALL 包含配置路径和环境变量名的引导信息

#### Scenario: 生成 API 错误

- **WHEN** 调用 `buildApiError("qwen-dashscope", 401, "Unauthorized")`
- **THEN** 系统 SHALL 返回包含 `error: "qwen_dashscope_api_error"` 和 `status: 401` 的对象
- **THEN** `message` SHALL 不包含 API Key

#### Scenario: 解析 DashScope 原生错误响应

- **WHEN** DashScope 返回 `{ "code": "InvalidApiKey", "message": "Invalid API-key provided.", "request_id": "abc123" }`
- **THEN** `buildDashScopeApiError` SHALL 提取 `code` 和 `message`，生成包含 `dashscope_code: "InvalidApiKey"` 的错误对象

---

### Requirement: Tool Schema 构建器

共享模块 SHALL 提供 `buildSearchToolSchema` 工具函数，用于构建标准的搜索工具参数 Schema。

Schema SHALL 包含：
- `query`：必需的字符串参数，描述为搜索关键字
- 其他可选参数由各 Provider 自行扩展

#### Scenario: 构建基础搜索 Schema

- **WHEN** 调用 `buildSearchToolSchema()`
- **THEN** 系统 SHALL 返回包含 `query: Type.String(...)` 的 `Type.Object`
- **THEN** Schema SHALL 设置 `additionalProperties: false`

---

### Requirement: 通用 Provider 注册中心

`src/provider.ts` SHALL 重构为 Provider 注册中心模式：

- 导出一个函数，返回所有可用 Provider 的数组
- 各 Provider 的创建函数从独立模块导入
- `index.ts` 遍历注册所有 Provider

#### Scenario: 注册多个 Provider

- **WHEN** 插件包含多个 Provider（如 qwen + metaso）
- **THEN** `index.ts` SHALL 遍历 Provider 数组，逐个调用 `api.registerWebSearchProvider()`
- **THEN** 每个 Provider SHALL 在 OpenClaw 中独立可见

#### Scenario: 单 Provider 注册

- **WHEN** 插件当前仅有通义百炼一个 Provider
- **THEN** Provider 数组 SHALL 只包含 qwen-dashscope
- **THEN** 注册逻辑 SHALL 与后续多 Provider 场景无需修改

---

### Requirement: 共享类型定义

共享模块 SHALL 提供以下类型定义，供各 Provider 复用：

- `ProviderConfig`：Provider 特定配置的基础类型（含 `apiKey`、`timeoutSeconds`）
- `SearchToolResult`：标准搜索工具返回结构
- `SearchToolError`：标准错误返回结构
- `DashScopeResponse`：DashScope 原生协议的响应类型定义（含 `output`、`usage`、`request_id`）
- `DashScopeSearchInfo`：DashScope 搜索来源信息类型定义（含 `search_results`、`extra_tool_info`）
- `DashScopeSearchResult`：单条搜索结果类型（含 `index`、`title`、`url`、`site_name`、`icon`）

#### Scenario: 类型一致性

- **WHEN** 各 Provider 使用共享类型构建返回值
- **THEN** 所有 Provider 的返回结构 SHALL 与 `WebSearchProviderToolDefinition` 的 `execute` 返回类型兼容

---

### Requirement: 通用配置读取工具

共享模块 SHALL 提供 `resolveProviderConfig` 工具函数，从 `SearchConfigRecord` 和插件配置中合并读取 Provider 的 scoped config。

合并优先级 SHALL 为：插件配置 > 旧式搜索配置 > 默认值。

#### Scenario: 插件配置覆盖旧式配置

- **WHEN** 插件配置中设置了 `model: "qwen3-max"`
- **WHEN** 旧式搜索配置中设置了 `model: "qwen-plus"`
- **THEN** 系统 SHALL 使用插件配置的值 `"qwen3-max"`

#### Scenario: 回退到默认值

- **WHEN** 所有配置源均未设置 `model`
- **THEN** 系统 SHALL 使用 Provider 定义的默认值

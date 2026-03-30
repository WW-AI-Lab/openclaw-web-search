## ADDED Requirements

### Requirement: Metaso Provider 注册与凭据解析
系统 SHALL 注册一个 id 为 `metaso` 的 `WebSearchProviderPlugin`，用于在 `openclaw-web-search` 中提供秘塔搜索能力。

Provider 元信息 SHALL 包含：

- `label`: `Metaso`
- `hint`: 说明其支持简单搜索、网页读取、深度研究三种模式
- `envVars`: `[`METASO_API_KEY`]`
- `credentialPath`: `plugins.entries.openclaw-web-search.config.metaso.apiKey`
- `docsUrl`: 指向秘塔 API playground 或正式文档页

凭据解析 SHALL 采用以下优先级：

1. `plugins.entries.openclaw-web-search.config.metaso.apiKey`
2. `tools.web.search.metaso.apiKey`
3. 环境变量 `METASO_API_KEY`

#### Scenario: 从插件配置读取秘钥
- **WHEN** `plugins.entries.openclaw-web-search.config.metaso.apiKey` 已配置
- **THEN** Provider SHALL 使用该值作为运行时秘钥
- **THEN** Provider SHALL 不继续回退到环境变量

#### Scenario: 从环境变量读取秘钥
- **WHEN** 插件配置与旧式搜索配置均未提供秘钥
- **THEN** Provider SHALL 从 `METASO_API_KEY` 读取秘钥

#### Scenario: 缺少秘钥时返回结构化错误
- **WHEN** 所有凭据来源都没有有效秘钥
- **THEN** Provider SHALL 返回结构化错误对象而不是抛出异常
- **THEN** 错误对象 SHALL 包含 `error: "missing_metaso_api_key"`
- **THEN** 错误信息 SHALL 不包含任何秘钥值

### Requirement: Provider SHALL 支持三种模式化调用
Metaso Provider SHALL 通过单一 Web Search Tool 支持以下模式：

- `search`：默认模式，按查询词执行搜索
- `reader`：按 URL 读取网页正文
- `deep_research`：按查询词执行深度研究

Tool 参数 SHALL 至少支持：

- `mode`：可选，默认 `search`
- `query`：`search` 与 `deep_research` 模式使用
- `url`：`reader` 模式使用

Provider SHALL 对模式与参数组合进行条件校验。

#### Scenario: 默认走简单搜索
- **WHEN** 调用未显式提供 `mode`
- **THEN** Provider SHALL 按 `search` 模式执行

#### Scenario: reader 模式需要 URL
- **WHEN** `mode` 为 `reader`
- **THEN** Provider SHALL 要求存在非空 `url` 参数
- **THEN** 若 `url` 缺失，Provider SHALL 返回参数校验错误

#### Scenario: deep_research 模式需要 query
- **WHEN** `mode` 为 `deep_research`
- **THEN** Provider SHALL 要求存在非空 `query` 参数
- **THEN** 若 `query` 缺失，Provider SHALL 返回参数校验错误

### Requirement: 简单搜索模式请求构建
当 `mode=search` 时，Provider SHALL 向 `https://metaso.cn/api/v1/search` 发送 `POST` 请求，并使用 Bearer 认证。

请求头 SHALL 至少包含：

- `Authorization: Bearer <apiKey>`
- `Accept: application/json`
- `Content-Type: application/json`

请求体 SHALL 支持以下字段：

- `q`
- `scope`
- `includeSummary`
- `size`
- `includeRawContent`
- `conciseSnippet`

Provider SHALL 仅向外部 API 发送当前调用所需的查询参数，不发送 OpenClaw 会话上下文。

#### Scenario: 使用默认搜索参数
- **WHEN** 用户仅提供 `query`
- **THEN** Provider SHALL 使用默认 `scope=webpage`
- **THEN** Provider SHALL 默认发送 `includeSummary=true`
- **THEN** Provider SHALL 默认发送 `size=10`

#### Scenario: 调用覆盖搜索配置
- **WHEN** 用户在调用时显式提供 `size` 或 `includeRawContent`
- **THEN** Provider SHALL 用调用参数覆盖配置默认值序列化请求体

### Requirement: 网页读取模式请求构建
当 `mode=reader` 时，Provider SHALL 向 `https://metaso.cn/api/v1/reader` 发送 `POST` 请求，并读取 `text/plain` 响应正文。

请求头 SHALL 至少包含：

- `Authorization: Bearer <apiKey>`
- `Accept: text/plain`
- `Content-Type: application/json`

请求体 SHALL 仅包含目标 `url`。

#### Scenario: reader 模式读取网页正文
- **WHEN** `mode=reader` 且提供有效 `url`
- **THEN** Provider SHALL 向 `reader` 端点发送包含该 URL 的请求
- **THEN** Provider SHALL 以纯文本方式读取响应正文

### Requirement: 深度研究模式请求构建
当 `mode=deep_research` 时，Provider SHALL 向 `https://metaso.cn/api/v1/chat/completions` 发送 `POST` 请求，并支持以下模型：

- `fast`
- `fast_thinking`
- `ds-r1`

请求体 SHALL 包含：

- `model`
- `stream: true`
- `messages: [{ role: "user", content: <query> }]`

Provider SHALL 在内部聚合流式事件，最终返回单个标准结果对象。

#### Scenario: 使用默认深度研究模型
- **WHEN** `mode=deep_research` 且未显式指定模型
- **THEN** Provider SHALL 使用配置默认模型
- **THEN** 默认模型 SHALL 为 `fast_thinking`

#### Scenario: 指定 ds-r1 模式
- **WHEN** `mode=deep_research` 且调用指定 `model=ds-r1`
- **THEN** Provider SHALL 将 `ds-r1` 透传到上游请求体

#### Scenario: 聚合流式研究结果
- **WHEN** 深度研究端点以流式事件返回内容
- **THEN** Provider SHALL 聚合所有有效文本增量为最终 `content`
- **THEN** Provider SHALL 在上游流结束后再返回结果对象

### Requirement: 响应归一化与内容隔离
不论使用哪一种模式，Provider SHALL 返回经过 OpenClaw 标准隔离包装的内容，并尽可能提供 citations。

返回结果 SHALL 包含：

- `query`
- `provider: "metaso"`
- `content`
- `citations`
- `tookMs`
- 在深度研究模式下可选包含 `model`

`content` SHALL 先经 `wrapWebContent()` 包裹后返回。

citations 提取策略 SHALL 为：

- `search`：优先使用结果列表中的 URL
- `reader`：至少包含被读取的目标 URL，并可附加正文中识别出的外链
- `deep_research`：优先使用流式事件中的结构化引用；若缺失，回退到正文 URL 提取

#### Scenario: search 模式返回结构化 citations
- **WHEN** Metaso 搜索响应中包含结果 URL 列表
- **THEN** Provider SHALL 将这些 URL 归一化为 `citations`

#### Scenario: reader 模式保留原始 URL
- **WHEN** reader 模式成功读取正文
- **THEN** Provider SHALL 至少把目标 `url` 放入 `citations`
- **THEN** 返回结果中的 `query` SHALL 记录该 URL

#### Scenario: 深度研究缺少结构化引用时回退
- **WHEN** 深度研究流中没有可直接提取的结构化引用
- **THEN** Provider SHALL 从聚合后的文本中回退提取 URL 并去重

### Requirement: 缓存与超时控制
Provider SHALL 对不同模式分别缓存结果，并通过 `buildSearchCacheKey` 构造不包含秘钥的缓存 key。

缓存 key SHALL 至少区分：

- `mode`
- `query` 或 `url`
- 搜索参数（如 `scope`、`size`、`includeSummary`、`includeRawContent`、`conciseSnippet`）
- 深度研究模型

Provider SHALL 支持基于配置解析请求超时，默认值为 30 秒。

#### Scenario: 相同 query 不同模式不共享缓存
- **WHEN** 同一输入先后以 `search` 和 `deep_research` 模式执行
- **THEN** Provider SHALL 生成不同的缓存 key

#### Scenario: reader 模式按 URL 缓存
- **WHEN** 同一个 `url` 在 `reader` 模式下重复请求
- **THEN** Provider SHALL 命中相同缓存项

### Requirement: 错误处理
Provider SHALL 对 HTTP 非 2xx、参数错误、流式聚合失败和上游异常返回结构化错误对象，不直接泄露上游秘钥。

错误对象 SHALL 至少包含：

- `error`
- `message`
- 可选 `status`

不同模式的错误标识 SHALL 可区分，例如：

- `metaso_search_api_error`
- `metaso_reader_api_error`
- `metaso_deep_research_api_error`

#### Scenario: search API 非 2xx
- **WHEN** `search` 端点返回非 2xx 响应
- **THEN** Provider SHALL 返回结构化错误对象
- **THEN** 错误对象 SHALL 包含对应 HTTP 状态码

#### Scenario: reader API 纯文本读取失败
- **WHEN** `reader` 端点返回非 2xx 或空正文
- **THEN** Provider SHALL 返回结构化错误而不是抛出未处理异常

#### Scenario: 深度研究流异常中断
- **WHEN** 深度研究事件流中断或返回无法解析的错误帧
- **THEN** Provider SHALL 返回结构化错误对象

### Requirement: 配置项定义
`openclaw.plugin.json` SHALL 为 `metaso` 新增配置子树，并为 UI 提供中文标签与帮助文本。

建议配置字段 SHALL 至少包括：

- `apiKey`
- `mode`
- `scope`
- `size`
- `includeSummary`
- `includeRawContent`
- `conciseSnippet`
- `deepResearchModel`
- `timeoutSeconds`

`providerAuthEnvVars` SHALL 新增 `metaso: ["METASO_API_KEY"]`。

#### Scenario: 配置向导可发现 Metaso
- **WHEN** OpenClaw 读取插件 manifest
- **THEN** 配置界面 SHALL 能展示 Metaso 的凭据输入和模式默认值说明

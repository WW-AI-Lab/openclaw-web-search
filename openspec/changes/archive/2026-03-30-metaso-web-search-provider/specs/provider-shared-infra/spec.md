## ADDED Requirements

### Requirement: 共享层 SHALL 支持多响应形态 Provider
`openclaw-web-search` 的共享基础设施 SHALL 允许 Provider 复用通用配置、缓存和错误处理能力，同时分别消费以下响应形态：

- JSON
- `text/plain`
- 流式事件响应

共享层 SHALL 不要求所有 Provider 都符合同一种上游响应结构。

#### Scenario: Provider 消费纯文本响应
- **WHEN** 某个 Provider 的端点返回 `text/plain`
- **THEN** 共享层 SHALL 允许该 Provider 在不绕开 `withTrustedWebSearchEndpoint` 的前提下读取纯文本正文

#### Scenario: Provider 消费流式响应
- **WHEN** 某个 Provider 的端点返回事件流
- **THEN** 共享层 SHALL 允许该 Provider 复用通用超时与受信任请求边界，并在 Provider 内完成聚合

### Requirement: 共享层 SHALL 支持 Provider 本地协议类型
共享层 SHALL 聚焦在真正可复用的行为能力上，包括：

- 凭据解析
- scoped config 合并
- Tool Schema 复用片段
- 缓存读写
- 通用错误构建

Provider 特有的响应类型、事件类型和字段解析规则 SHALL 可以保留在各自目录中定义，而不强制进入共享类型文件。

#### Scenario: Metaso 使用本地响应类型
- **WHEN** Metaso Provider 需要定义搜索响应、reader 文本结果或 SSE 事件结构
- **THEN** 实现 SHALL 可以在 `src/providers/metaso/` 下定义这些类型
- **THEN** 共享层 SHALL 仍可复用通用配置、缓存和错误工具

### Requirement: 缓存工具 SHALL 支持模式化 key 组合
共享层 SHALL 支持 Provider 在构建缓存 key 时组合 `mode`、查询参数、URL、模型等多维因子，并确保敏感凭据不被写入缓存 key。

#### Scenario: mode 参与缓存键
- **WHEN** Provider 为同一 query 同时支持 `search` 与 `deep_research`
- **THEN** 共享缓存工具 SHALL 允许把 `mode` 纳入 key 因子，避免不同模式误命中

#### Scenario: URL 参与缓存键
- **WHEN** Provider 的某个模式以 URL 作为主输入
- **THEN** 共享缓存工具 SHALL 允许直接使用 URL 作为 key 因子之一

### Requirement: 通用错误构建 SHALL 避免泄露秘钥并允许 Provider 扩展
共享错误工具 SHALL 保证返回结构化错误对象，且错误消息中不得包含秘钥值；同时，Provider SHALL 可以在通用错误之上附加模式名、上游 request id 或 provider-specific code。

#### Scenario: Provider 附加模式级错误标识
- **WHEN** Metaso 的 `reader` 或 `deep_research` 端点失败
- **THEN** Provider SHALL 可以生成不同的错误标识
- **THEN** 错误消息 SHALL 仍然遵守不泄露秘钥的规则
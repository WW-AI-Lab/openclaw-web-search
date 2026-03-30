## Why

`openclaw-web-search` 当前只有 Qwen Provider，且现有共享层主要围绕 DashScope 原生协议设计。秘塔搜索（Metaso）提供了与 Qwen 明显不同的三类能力组合：简单搜索、网页读取、深度研究；如果直接在现有结构上硬接，会把共享层进一步绑死在单一 Provider 的请求/响应假设上。

现在补齐 Metaso Provider 的价值有两层：一是为独立插件新增一个国产搜索来源，二是验证 `openclaw/plugin-sdk/provider-web-search` 在 2026.3.28 版本下承载多端点、纯文本读取和流式研究聚合的可行实现路径，并把相关兼容约束沉淀成正式规格。

## What Changes

- 新增 `metaso` Web Search Provider，统一承载三种执行模式：
  - 简单搜索：调用 `POST https://metaso.cn/api/v1/search`
  - 网页读取：调用 `POST https://metaso.cn/api/v1/reader`
  - 深度研究：调用 `POST https://metaso.cn/api/v1/chat/completions`
- 通过单一 Provider 入口暴露 Metaso 能力，保持一个凭据路径、一个 onboarding 入口和一个 `providerAuthEnvVars` 声明。
- 扩展共享基础设施，使其能够支持：
  - JSON 响应与 `text/plain` 响应并存
  - 上游流式研究响应的聚合式消费
  - Provider 本地类型与共享通用辅助函数并存，而不继续把共享层耦合到 DashScope 专名
- 更新 `openclaw.plugin.json` 的 `configSchema`、`uiHints`、`providerAuthEnvVars`，新增 `metaso` 配置子树。
- 更新 `src/provider.ts`、`index.ts` 和相关测试，确保 Metaso 能被 OpenClaw 2026.3.28 的标准 Provider 注册路径发现。
- 审核并必要时更新 `package.json` 中 OpenClaw 兼容元数据，明确本次变更遵守的 SDK 入口、manifest 字段与发布约束；不引入任何额外的插件侧签名机制。
- 补充文档和验收步骤，明确真实联调只能通过环境变量提供 `METASO_API_KEY`，禁止把秘钥写入代码、测试样例或仓库文档。

## Capabilities

### New Capabilities
- `metaso-provider`: 为 `openclaw-web-search` 新增秘塔搜索 Provider，支持简单搜索、网页读取、深度研究三种模式及对应的配置、缓存、错误处理和响应归一化。

### Modified Capabilities
- `provider-shared-infra`: 共享基础设施新增对纯文本响应、流式响应聚合、Provider 本地协议类型和模式化缓存键的支撑，不再默认所有 Provider 都遵循 DashScope 风格响应。

## Impact

- 受影响代码：`openclaw-web-search` 中的 `src/providers/shared/*`、新增的 `src/providers/metaso/*`、`src/provider.ts`、`index.ts`、`openclaw.plugin.json`、`package.json`、`README.md`、`CHANGELOG.md`。
- 受影响配置：新增 `plugins.entries.openclaw-web-search.config.metaso.*`，兼容读取 `tools.web.search.metaso.*`，新增环境变量 `METASO_API_KEY`。
- 受影响测试：需要新增 Metaso Provider 单测，并补充 shared helper 的回归测试，覆盖 JSON、纯文本、流式聚合三类路径。
- 依赖与安全边界：继续只使用 `openclaw/plugin-sdk/plugin-entry` 与 `openclaw/plugin-sdk/provider-web-search` 公开入口；所有外部 HTTP 仍必须走 `withTrustedWebSearchEndpoint`；不把秘钥写入缓存 key、错误对象或测试夹具。
## Context

目标仓库是独立插件 `openclaw-web-search`，其现状可概括为：

- 已存在一个基于 DashScope 原生协议的 Qwen Provider。
- 共享模块已经具备配置读取、错误构建、Tool Schema 和缓存辅助，但语义上仍偏向 DashScope。
- 插件元数据已对齐到 OpenClaw 2026.3.28 的构建版本，并通过 `openclaw/plugin-sdk/plugin-entry` 和 `openclaw/plugin-sdk/provider-web-search` 接入公开 SDK。

Metaso 与现有 Qwen Provider 的差异不在“又一个 JSON 搜索接口”，而在于它同时提供三条不同的上游调用路径：

1. `search`：标准 JSON 搜索结果。
2. `reader`：返回 `text/plain` 的网页正文读取。
3. `chat/completions`：以流式形式输出深度研究内容，并带有模型模式 `fast`、`fast_thinking`、`ds-r1`。

这意味着如果实现得过于草率，会出现两个问题：

- Provider 层为兼容三种模式而堆出大量分支，shared 层仍无法复用给后续 `doubao`、`zhipu`。
- 为了适配 Metaso 流式研究而在插件里引入不必要的“签名”或私有 SDK 依赖，偏离 2026.3.28 的公开插件接入边界。

此外，本次变更明确遵守两条安全原则：

- 真实秘钥只通过配置引用或环境变量注入，不写入仓库内容。
- 不假定 OpenClaw 存在额外的 Web Search Provider 级“请求签名”扩展点；插件运行时安全仍以 `openclaw.plugin.json` 清单校验、兼容字段和 `withTrustedWebSearchEndpoint` 为边界。

## Goals / Non-Goals

**Goals:**

- 为 `openclaw-web-search` 增加一个 id 为 `metaso` 的 Web Search Provider。
- 通过单一 Provider 入口支持 `search`、`reader`、`deep_research` 三种运行模式。
- 保持与 OpenClaw 2026.3.28 公开 SDK 兼容，只依赖标准 `WebSearchProviderPlugin` 和 `definePluginEntry` 接口。
- 让共享层足以支撑后续“多端点 + 多响应形态”的 Provider，而不强迫现有 Qwen 代码进行大规模重命名。
- 将秘塔 API 的认证、模式、缓存、错误和响应归一化沉淀为可测试的规格。

**Non-Goals:**

- 不在本次变更中实现 Doubao、Zhipu 或其他 Provider。
- 不在本次变更中引入新的 OpenClaw 私有 SDK 依赖、私有 `src/**` import 或自定义插件签名机制。
- 不要求深度研究以“流式返回给 agent”的方式暴露；本次只要求 Provider 在内部聚合流式响应后返回标准结果对象。
- 不把秘塔 playground 中的真实凭据、示例 key 或响应样本写入仓库文件。
- 不为了“统一命名”强制重命名所有现有 DashScope 类型；若不影响复用，则优先最小改动。

## Decisions

### 决策 1：采用单一 `metaso` Provider，而不是三个独立 Provider

**选择**：新增一个 `metaso` Provider，在单个 Tool Schema 下通过 `mode` 区分 `search`、`reader`、`deep_research`。

**理由：**

- 一个凭据路径即可覆盖三种能力：`plugins.entries.openclaw-web-search.config.metaso.apiKey`。
- 对 OpenClaw 的 onboarding、doctor、provider 选择逻辑更简单，用户不会在 UI 中看到三个几乎相同的 Metaso 供应商。
- 简单搜索仍可作为默认行为，兼容通用 `web_search` 使用习惯；读取和深度研究则作为显式高级模式出现。

**替代方案**：拆成 `metaso-search`、`metaso-reader`、`metaso-research` 三个 Provider。

**不选原因**：会复制凭据、配置、文档和注册逻辑，也会让自动探测与用户选择变得混乱。

### 决策 2：三种模式与上游端点一一映射，但对 OpenClaw 只暴露统一结果模型

**选择**：

- `mode=search` → `POST https://metaso.cn/api/v1/search`
- `mode=reader` → `POST https://metaso.cn/api/v1/reader`
- `mode=deep_research` → `POST https://metaso.cn/api/v1/chat/completions`

三种模式最终都归一化到同一种 OpenClaw 结果对象：`query/provider/content/citations/tookMs/model?`。

**理由：**

- `WebSearchProviderToolDefinition.execute` 在 2026.3.28 下只要求返回 `Promise<Record<string, unknown>>`，因此可以在 Provider 内部屏蔽上游差异。
- OpenClaw 上层只需要一个稳定的消费模型；不应把 Metaso 的原始响应协议泄漏到 Agent 层。
- `reader` 模式虽然输入是 URL 而不是自然语言查询，但仍可通过把目标 URL 记录到结果的 `query` 字段来保持标准结构。

**替代方案**：为 `reader` 和 `deep_research` 设计完全不同的返回形状。

**不选原因**：会削弱 shared test 与缓存逻辑的一致性，也让后续 provider 的统一接入更困难。

### 决策 3：深度研究模式采用“流式消费，非流式返回”

**选择**：对 `/api/v1/chat/completions` 使用 Metaso 要求的流式调用方式，在 Provider 内部聚合事件流，返回最终文本与 citations。

**理由：**

- 用户给出的契约明确展示了 `stream: true` 的使用方式。
- OpenClaw 当前 `WebSearchProviderPlugin` 并没有为 Web Search Provider 定义原生流式回传接口；最稳妥的落地方式是在 Provider 内完成聚合。
- 这样既能支持 `fast`、`fast_thinking`、`ds-r1` 三种研究模型，也不会突破现有插件 SDK 边界。

**替代方案**：

- 假设 Metaso 也支持 `stream: false`，直接等待单次 JSON 响应。
- 在插件层自建额外的流式中转协议。

**不选原因**：前者没有从现有材料中得到确认；后者会把提案从“新增 Provider”扩展成“扩展 OpenClaw Web Search 协议”。

### 决策 4：共享层做“最小泛化”，不做破坏性重命名

**选择**：

- 保留现有对 Qwen 已稳定工作的 shared helper。
- 新增或补齐真正通用的能力：纯文本响应处理、SSE 聚合辅助、模式化缓存 key、通用 API 错误构建器。
- Metaso 的上游响应类型和事件类型放在 `src/providers/metaso/` 本地定义，不强迫把现有 DashScope 类型全部迁走。

**理由：**

- 这样能在保持 Qwen 稳定的前提下扩展新 provider。
- “先全量去 Qwen 化再上 Metaso”属于高风险重构，不适合作为这次需求的前置条件。
- 共享层真正需要共享的是行为，而不是所有上游协议类型。

**替代方案**：先大规模重命名 shared/types.ts、shared/errors.ts 中所有 DashScope 相关类型与函数，再接 Metaso。

**不选原因**：收益不足以覆盖回归风险。

### 决策 5：配置与参数设计采用“配置默认值 + 调用时可覆盖”的组合

**选择**：在 `openclaw.plugin.json` 中新增 `metaso` 配置子树，建议字段包括：

- `apiKey`
- `mode`（默认 `search`）
- `scope`（默认 `webpage`）
- `size`（默认 `10`）
- `includeSummary`（默认 `true`）
- `includeRawContent`（默认 `false`）
- `conciseSnippet`（默认 `false`）
- `deepResearchModel`（默认 `fast_thinking`）
- `timeoutSeconds`（默认 `30`）

Tool 调用时允许以参数覆盖对应默认值。

**理由：**

- 配置层负责“组织默认偏好”，调用层负责“单次任务差异化”。
- 这与现有 Qwen Provider 的配置风格一致，便于统一文档和 doctor 展示。

### 决策 6：凭据解析与自动探测优先级保持 OpenClaw 标准模式

**选择**：

凭据优先级为：

1. `plugins.entries.openclaw-web-search.config.metaso.apiKey`
2. `tools.web.search.metaso.apiKey`
3. `METASO_API_KEY`

`autoDetectOrder` 取值高于现有 Qwen 默认顺位，避免在多 Provider 同时配置时无故抢占默认选择。

**理由：**

- 与现有插件的 scoped config 约定一致。
- `METASO_API_KEY` 与 Qwen 的环境变量不冲突，因此自动探测只需避免影响已有 qwen 默认体验。

### 决策 7：SDK 与“签名机制”的结论以公开接口和 manifest 约束为准

**选择**：

- 继续只从 `openclaw/plugin-sdk/plugin-entry` 与 `openclaw/plugin-sdk/provider-web-search` 导入能力。
- `package.json` 的 `openclaw.build.openclawVersion` 与 `openclaw.build.pluginSdkVersion` 维持在 2026.3.28 基线，`compat.pluginApi` / `compat.minGatewayVersion` 仅在实现验证需要时再提升。
- 本次不引入任何 Metaso 特有或插件特有的“签名机制”；Metaso 上游认证仍是 `Authorization: Bearer <apiKey>`。

**理由：**

- 2026.3.28 的公开 SDK 已经给出了 `WebSearchProviderPlugin`、`registerWebSearchProvider` 和 `withTrustedWebSearchEndpoint` 的完整接入面。
- OpenClaw 对原生插件的前置校验来自 `openclaw.plugin.json` 与 `package.json.openclaw.*` 兼容字段，而不是为 Web Search Provider 单独定义的请求签名扩展。
- 把不存在的签名机制写进设计，只会制造实现歧义。

## Risks / Trade-offs

- [风险] Metaso 搜索与深度研究的精确响应字段尚未在仓库中固化样本。 -> 通过实现阶段的 env-only 联调先捕获脱敏样本，再锁定解析优先级；解析逻辑先以“结构化字段优先，正则 fallback”设计。
- [风险] 深度研究的 SSE 事件格式可能与常见 OpenAI 风格不同。 -> 采用容错解析器，支持 `data:` 帧、多事件拼接和 `[DONE]` 结束标记，并为异常事件提供结构化错误。
- [权衡] 单一 Provider 的 Tool Schema 会比单模式搜索更复杂。 -> 通过默认 `mode=search` 和清晰的条件校验，把复杂度限制在高级用法。
- [权衡] 不大规模重命名 shared 层会保留部分 DashScope 术语。 -> 本次优先保证功能落地与回归面可控，后续若再接入更多 provider，再发起独立清理变更。
- [风险] 多 Provider 并存时默认选择行为变化。 -> 将 Metaso `autoDetectOrder` 放在不抢占 Qwen 默认的区间，并在 README 中明确说明如何显式指定 provider。

## Migration Plan

- 无数据迁移要求。
- 实现阶段先补 `openclaw.plugin.json` 和 `package.json` 元数据，再增加 provider 代码与测试。
- 回滚时只需移除 `metaso` provider 注册、configSchema/uiHints 条目及相关文档，不影响现有 qwen provider。

## Open Questions

- Metaso `search` 响应中用于 summary、results、raw content 的精确字段名，需要在真实联调时捕获一次脱敏样本确认。
- Metaso `chat/completions` 是否支持非流式模式；若支持，是否值得作为实现 fallback。
- `reader` 模式是否需要暴露额外内容裁剪参数，还是先保持最小接口只接收 URL。
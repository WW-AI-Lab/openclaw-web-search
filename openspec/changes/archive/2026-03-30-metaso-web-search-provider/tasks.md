## 1. SDK 与清单对齐

- [x] 1.1 [sdk] 核对 `package.json` 中 `openclaw.compat.*`、`openclaw.build.*`、`openclaw.install.*` 是否仍满足 2026.3.28 插件 SDK 要求，并仅在必要时更新
- [x] 1.2 [plugin] 设计并补充 `openclaw.plugin.json` 的 `metaso` 配置项、`uiHints` 与 `providerAuthEnvVars`
- [x] 1.3 [shared] 评估现有 shared helper 中哪些能力继续复用，哪些需要新增以支持纯文本与流式响应

## 2. Metaso Provider 核心实现

- [x] 2.1 [metaso] 创建 `src/providers/metaso/` 目录及 Provider 本地类型定义
- [x] 2.2 [metaso] 实现凭据解析与运行时配置解析，支持插件配置、旧式配置和环境变量回退
- [x] 2.3 [metaso] 实现 `search` 模式的请求构建、响应归一化、citations 提取与缓存写入
- [x] 2.4 [metaso] 实现 `reader` 模式的纯文本读取、内容包装、citations 归一化与缓存写入
- [x] 2.5 [metaso] 实现 `deep_research` 模式的 SSE/流式聚合、`fast`/`fast_thinking`/`ds-r1` 模型切换与 citations 提取
- [x] 2.6 [provider] 更新 `src/provider.ts` 和 `index.ts`，注册 Metaso Provider 并设置合适的 `autoDetectOrder`

## 3. 共享基础设施与错误处理

- [x] 3.1 [shared] 为多响应形态 Provider 增补通用 helper，覆盖 JSON、`text/plain` 与流式事件消费场景
- [x] 3.2 [shared] 扩展模式化缓存 key 组合方式，确保 `mode`、`url`、模型等因子可复用且不包含秘钥
- [x] 3.3 [shared] 补充通用错误构建与 Provider 扩展点，确保不同模式都返回结构化错误对象

## 4. 测试与验收

- [x] 4.1 [metaso/test] 覆盖缺少秘钥、参数校验失败和 Provider 注册元数据测试
- [x] 4.2 [metaso/test] 覆盖 `search` 模式的请求体序列化、缓存命中、响应归一化与非 2xx 错误测试
- [x] 4.3 [metaso/test] 覆盖 `reader` 模式的纯文本读取、URL citations 与错误处理测试
- [x] 4.4 [metaso/test] 覆盖 `deep_research` 模式的流式聚合、模型切换与异常流处理测试
- [x] 4.5 [shared/test] 为新增 shared helper 补充回归测试，验证多响应形态和模式化缓存键行为

## 5. 文档与手工验证

- [x] 5.1 [docs] 更新 README、AGENTS 和 CHANGELOG，新增 Metaso 配置说明、三种模式示例与安全边界说明
- [x] 5.2 [验证] 仅通过环境变量 `METASO_API_KEY` 进行真实联调，验证 `search`、`reader`、`deep_research` 三种模式，且不把秘钥写入代码、测试或仓库文档
- [x] 5.3 [验证] 运行类型检查、单元测试和本地插件安装验证，确认 OpenClaw 可以发现并使用 Metaso Provider
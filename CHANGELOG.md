# 变更日志

## 2026.3.30

- 新增 Metaso Web Search Provider，支持 `search`、`reader`、`deep_research` 三种模式
- 为 Metaso 增加插件配置、旧式搜索配置和 `METASO_API_KEY` 环境变量三层凭据解析
- 扩展 shared helper，补充 JSON 错误解析、纯文本 URL 提取和 SSE 数据聚合能力
- 更新 `openclaw.plugin.json` 与 `package.json`，对齐 OpenClaw `>= 2026.3.28` 兼容要求
- 为 Metaso 与 shared 新能力补充单元测试
- 修复 Metaso `search` 模式对 `webpages` 响应结构的解析，并通过缓存键版本升级避开历史空结果缓存


## 2026.3.25

- 首次发布 `@ww-ai-lab/openclaw-web-search`
- 提供 Qwen（DashScope 原生协议）搜索 Provider
- 补充中文 README、安装说明、配置说明与路线图
- 调整 Provider 标识为 `qwen`，统一配置键与测试用例
- 增加 MIT 许可证与 GitHub / npm 发布元数据

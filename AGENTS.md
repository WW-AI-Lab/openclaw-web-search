# openclaw-web-search 开发指南

> **本文件是 AI 代理（Cursor / Codex / Claude 等）的上下文指引文件。**
> 人类开发者请参阅 [README.md](./README.md) 和 [docs/开发最佳实践.md](./docs/开发最佳实践.md)。

## 项目定位

`openclaw-web-search` 是 [OpenClaw](https://github.com/openclaw/openclaw) 的**独立外部插件**，专注于为 OpenClaw 扩展国产模型内置搜索及第三方搜索服务的接入能力。

目标接入的搜索提供商（按字母序）：

- 豆包（ByteDance / Doubao）
- 千问搜索（Qwen / DashScope）
- 秘塔搜索（Metaso）
- 智普搜索（Zhipu AI / GLM）
- 其他兼容 OpenAI 接口的搜索服务

本插件不属于 OpenClaw 主仓库的 `extensions/*`，而是作为独立 npm 包发布并通过 `openclaw plugins install` 安装。

npm 包名：`@ww-ai-lab/openclaw-web-search`
GitHub：`git@github.com:WW-AI-Lab/openclaw-web-search.git`

---

## 目录结构

```text
openclaw-web-search/
  .git/
  .gitignore
  AGENTS.md              ← 本文件（AI 上下文）
  README.md              ← 用户文档
  package.json
  tsconfig.json
  openclaw.plugin.json   ← 插件 manifest
  index.ts               ← 插件注册入口（只做注册）
  openspec/
    config.yaml          ← OpenSpec 工作流配置
  src/
    provider.ts          ← WebSearchProviderPlugin 实现（当前为骨架）
    providers/           ← （待创建）各搜索提供商子模块
      metaso/            ← 秘塔搜索
      qwen/              ← 千问/通义千问
      doubao/            ← 豆包
      zhipu/             ← 智普
  docs/
    开发最佳实践.md
```

---

## 插件 SDK 接入规范

### 公开 SDK 入口（只能使用这些）

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import {
  buildSearchCacheKey,
  readCachedSearchPayload,
  readConfiguredSecretString,
  readNumberParam,
  readProviderEnvValue,
  readStringParam,
  resolveSearchCacheTtlMs,
  resolveSearchTimeoutSeconds,
  withTrustedWebSearchEndpoint,
  wrapWebContent,
  writeCachedSearchPayload,
  type SearchConfigRecord,
  type WebSearchProviderPlugin,
  type WebSearchProviderToolDefinition,
} from "openclaw/plugin-sdk/provider-web-search";
```

**禁止**直接 import OpenClaw 主仓库的 `src/**` 私有路径。

### WebSearchProviderPlugin 必须实现的字段

```typescript
{
  id: string;                 // 与 openclaw.plugin.json 的 id 一致
  label: string;              // 显示名
  hint: string;               // 简短说明
  envVars: string[];          // 凭据环境变量名（按优先级排序）
  placeholder: string;        // API key 占位符
  signupUrl: string;          // 申请 key 的链接
  docsUrl: string;            // 文档链接
  credentialPath: string;     // OpenClaw 配置中凭据的路径
  inactiveSecretPaths: string[]; // 需要清理的旧路径
  getCredentialValue: (searchConfig?) => unknown;
  setCredentialValue: (target, value) => void;
  getConfiguredCredentialValue: (config?) => unknown;
  setConfiguredCredentialValue: (target, value) => void;
  createTool: (ctx) => WebSearchProviderToolDefinition;
  autoDetectOrder?: number;   // 自动检测顺序（数值越小越优先）
}
```

### 工具返回结构（必须包含）

```typescript
{
  query: string;
  provider: string;
  content: string;      // 必须用 wrapWebContent() 包裹
  citations: string[];
  tookMs?: number;      // 可选，耗时毫秒
}
```

---

## 每个 Provider 的实现模式

参考 `openai-search` 插件（位于父目录 `../extensions/openai-search/`）的实现方式：

1. **Provider 配置解析**：从 `searchConfig?.{scopeKey}` 读取 scoped config
2. **凭据解析**：`readConfiguredSecretString` + `readProviderEnvValue` 双路径
3. **缓存**：用 `buildSearchCacheKey` + `readCachedSearchPayload` / `writeCachedSearchPayload`
4. **HTTP 请求**：必须走 `withTrustedWebSearchEndpoint`，不能裸用 `fetch`
5. **内容包裹**：返回前必须 `wrapWebContent(content)`
6. **错误处理**：非 2xx 返回结构化 error 对象而非抛出异常

---

## 配置键约定

每个 provider 在 `tools.web.search` 下有独立 scoped key：

| Provider | scoped key | 环境变量 |
|---|---|---|
| 秘塔搜索 | `metaso` | `METASO_API_KEY` |
| 千问搜索 | `qwen` / `openaiSearch` | `DASHSCOPE_API_KEY` |
| 豆包 | `doubao` | `DOUBAO_API_KEY` / `ARK_API_KEY` |
| 智普搜索 | `zhipu` | `ZHIPU_API_KEY` |

凭据优先级（从高到低）：
1. `plugins.entries.openclaw-web-search.config.webSearch.apiKey`（插件配置）
2. `tools.web.search.{scopeKey}.apiKey`（旧式配置）
3. 对应环境变量

---

## OpenSpec 工作流

本项目使用 OpenSpec (`openspec/`) 管理需求提案与任务。

**重要规则**：所有提案（proposal）、Spec、场景与验收标准**必须用中文撰写**。

常用命令（需安装 OpenSpec CLI）：

```bash
# 创建新提案（中文描述）
openspec propose

# 查看当前提案状态
openspec list

# 开始实现某个变更
openspec apply <change-id>
```

---

## 开发命令

```bash
# 安装依赖（将 openclaw 主仓库作为本地依赖）
npm install

# 类型检查
npm run check

# 本地联调
cd /path/to/openclaw
openclaw plugins install -l /path/to/openclaw-web-search
openclaw plugins enable openclaw-web-search
openclaw gateway restart
```

---

## 测试要求

每个 provider 至少覆盖：

- [ ] 缺少 API key 时返回结构化错误（非抛出异常）
- [ ] `query` 参数为空/非字符串时报错正确
- [ ] 请求 body 序列化正确
- [ ] 正常响应归一化为 `content` + `citations`
- [ ] 缓存命中路径正确返回缓存内容
- [ ] 非 2xx 响应返回可诊断的错误信息

测试文件命名：`src/providers/{name}/{name}.test.ts`

---

## 发布说明

- npm 包名：`@ww-ai-lab/openclaw-web-search`
- `openclaw` 放在 `peerDependencies`（不要放 `dependencies`）
- 版本格式：`YYYY.M.D`（对齐 OpenClaw 风格）
- 发布前更新 `CHANGELOG.md`

```bash
npm publish --access public
```

---

## 安全边界

- 不要把 API key 拼入缓存 key
- 不要把 API key 写进错误信息
- 不要向外部搜索 API 发送用户敏感上下文（只发送 query）
- 外部搜索结果必须经过 `wrapWebContent()` 隔离后再返回给 agent

---

## 其他注意事项

- 禁止修改 `node_modules`
- 禁止依赖 OpenClaw 主仓库的 `src/**` 私有路径
- 新增 provider 时必须在 `openclaw.plugin.json` 的 `configSchema` 和 `uiHints` 中同步更新
- AI 代理在执行大范围文件修改前，须先在中文中说明预期影响面并等待用户确认

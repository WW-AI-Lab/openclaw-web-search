# openclaw-web-search

[![npm](https://img.shields.io/npm/v/@ww-ai-lab/openclaw-web-search)](https://www.npmjs.com/package/@ww-ai-lab/openclaw-web-search)
[![GitHub](https://img.shields.io/badge/GitHub-WW--AI--Lab%2Fopenclaw--web--search-blue)](https://github.com/WW-AI-Lab/openclaw-web-search)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

`openclaw-web-search` 是 [OpenClaw](https://github.com/openclaw/openclaw) 的独立外部插件，用来补齐 OpenClaw 默认缺少国产大模型联网搜索能力的问题。

这个项目的目标很直接：把国产搜索 Provider 做成可安装、可配置、可发布的独立插件，让 OpenClaw 能更方便地接入千问、豆包、秘塔、智普等国产搜索线路。

## 为什么需要这个插件

这个插件不属于 OpenClaw 主仓库内置 `extensions/*`，而是作为外部插件发布：

- npm 包名：`@ww-ai-lab/openclaw-web-search`
- 插件 ID：`openclaw-web-search`
- 发布方式：`openclaw plugins install @ww-ai-lab/openclaw-web-search`
- 许可证：MIT

它要解决的问题是：

- OpenClaw 默认没有开箱即用的国产大模型搜索适配。
- 不同国产搜索服务的协议、鉴权方式、返回结构并不一致。
- 需要一个独立插件，把这些差异统一收敛到 OpenClaw 的 `web_search` Provider 接口中。
- 插件独立发布后，可以不依赖 OpenClaw 主仓库发版节奏，逐步增加新的国产搜索 Provider。

## 已支持与规划中的 Provider

| 提供商 | provider id | 状态 | 说明 |
|---|---|---|---|
| 通义百炼（DashScope） | `qwen` | 已实现 | 走 DashScope 原生协议，支持结构化来源与引用角标 |
| 秘塔搜索 | `metaso` | 已实现 | 支持简单搜索、网页读取和深度研究三种模式 |
| 豆包 / 火山引擎 ARK | `doubao` | 规划中 | 接入豆包原生搜索或兼容线路 |
| 智普 GLM 搜索 | `zhipu` | 规划中 | 接入智普原生 Web 搜索能力 |
| 其他兼容接口的搜索服务 | `compatible` | 规划中 | 作为补充线路，适配更多可接入的搜索服务 |

## 路线图

本项目按“先打通一条稳定可用线路，再逐步扩展国产搜索 Provider”的方式推进：

1. ✅ 第一阶段：完成 Qwen（DashScope 原生协议）接入，验证插件配置、缓存、错误处理、引用输出、npm 发布链路。（已发布 v2026.3.25）
2. ✅ 第二阶段：完成 Metaso 接入，支持 `search` / `reader` / `deep_research` 三种模式，修复 `webpages` 响应解析与插件加载兼容性。（已发布 v2026.3.30）
3. 第三阶段：增加豆包 / ARK 与智普搜索，继续补充响应归一化测试。
4. 第四阶段：抽象更多共享基础设施，兼容更多可接入的搜索服务。
5. 第五阶段：完善 Provider 选择策略、文档、示例与自动化发布流程。

## 安装说明

### 前置要求

| 依赖 | 要求 |
|---|---|
| OpenClaw | `>= 2026.3.28` |
| Node.js | `>= 22` |

### 方式一：从 npm 安装

```bash
openclaw plugins install @ww-ai-lab/openclaw-web-search
openclaw plugins enable openclaw-web-search
openclaw gateway restart
```

### 方式二：从源码本地安装

```bash
git clone git@github.com:WW-AI-Lab/openclaw-web-search.git
cd openclaw-web-search
npm install

# 在 OpenClaw 主目录执行
openclaw plugins install -l /path/to/openclaw-web-search
openclaw plugins enable openclaw-web-search
openclaw gateway restart
```

### 安装后检查

如果 OpenClaw 已正确加载插件，应能在插件列表中看到 `openclaw-web-search`，并在配置中看到 `qwen` 与 `metaso` 相关字段。

## 配置说明

当前已实现 Qwen 与 Metaso 两条线路，均支持三种配置方式。

### 方式一：插件配置，推荐

```json5
{
  plugins: {
    entries: {
      "openclaw-web-search": {
        enabled: true,
        config: {
          qwen: {
            apiKey: "sk-...",
            model: "qwen-plus",
            searchStrategy: "turbo",
            forcedSearch: false,
            enableThinking: false,
            enableSearchExtension: false,
            enableSource: true,
            enableCitation: false,
            citationFormat: "[<number>]",
            freshness: 30,
            timeoutSeconds: 30
          },
          metaso: {
            apiKey: "mk-...",
            mode: "search",
            scope: "webpage",
            size: 10,
            includeSummary: true,
            includeRawContent: false,
            conciseSnippet: false,
            deepResearchModel: "fast_thinking",
            timeoutSeconds: 30
          }
        }
      }
    }
  }
}
```

### 方式二：兼容旧式搜索配置

```json5
{
  tools: {
    web: {
      search: {
        qwen: {
          apiKey: "sk-..."
        },
        metaso: {
          apiKey: "mk-..."
        }
      }
    }
  }
}
```

### 方式三：环境变量

```bash
export DASHSCOPE_API_KEY="sk-..."
export METASO_API_KEY="mk-..."
```

凭据优先级从高到低如下：

1. `plugins.entries.openclaw-web-search.config.qwen.apiKey`
2. `tools.web.search.qwen.apiKey`
3. `DASHSCOPE_API_KEY`

Metaso 的凭据优先级从高到低如下：

1. `plugins.entries.openclaw-web-search.config.metaso.apiKey`
2. `tools.web.search.metaso.apiKey`
3. `METASO_API_KEY`

## Qwen 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `apiKey` | `string` | 无 | DashScope API Key |
| `model` | `string` | `qwen-plus` | 联网搜索使用的模型 |
| `searchStrategy` | `string` | `turbo` | `turbo` 为轻量搜索，`max` 为深度搜索 |
| `forcedSearch` | `boolean` | `false` | 是否强制执行搜索 |
| `enableThinking` | `boolean` | `false` | 是否启用深度思考 |
| `enableSearchExtension` | `boolean` | `false` | 是否启用垂域搜索扩展 |
| `enableSource` | `boolean` | `true` | 是否返回搜索来源 |
| `enableCitation` | `boolean` | `false` | 是否在内容中插入角标引用 |
| `citationFormat` | `string` | `[<number>]` | 引用角标格式 |
| `freshness` | `number` | 不限制 | 结果时效性，可选 `7`、`30`、`180`、`365` |
| `timeoutSeconds` | `number` | `30` | 请求超时时间，单位秒 |

## 支持的 Qwen 模型

默认模型为 `qwen-plus`。你也可以按 DashScope 平台实际支持情况切换到其他联网模型，例如：

- `qwen3-max`
- `qwen-max-latest`
- `qwen3.5-plus`
- `qwen-plus-latest`
- `qwen3.5-flash`
- `qwen-turbo`
- `qwq-plus`
- `deepseek-v3.2`
- `deepseek-r1`

插件不会对模型名做强校验，以便兼容 DashScope 后续新增的模型。

## Metaso 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `apiKey` | `string` | 无 | Metaso API Key |
| `mode` | `string` | `search` | 默认模式，可选 `search`、`reader`、`deep_research` |
| `scope` | `string` | `webpage` | `search` 模式下的范围参数 |
| `size` | `number` | `10` | `search` 模式返回条数，范围 `1-10` |
| `includeSummary` | `boolean` | `true` | 是否请求汇总摘要 |
| `includeRawContent` | `boolean` | `false` | 是否请求原始正文 |
| `conciseSnippet` | `boolean` | `false` | 是否请求更短的摘要片段 |
| `deepResearchModel` | `string` | `fast_thinking` | `deep_research` 模式默认模型 |
| `timeoutSeconds` | `number` | `30` | 请求超时时间，单位秒 |

## Metaso 三种模式

### 简单搜索 `search`

适合通用 Web 搜索，输入 `query`，返回摘要、结果列表与 citations。

```json5
{
  query: "OpenClaw 插件系统",
  mode: "search",
  size: 5,
  includeSummary: true
}
```

### 网页读取 `reader`

适合对单个 URL 做正文提取，输入 `url`，返回包装后的纯文本正文与 URL citations。

```json5
{
  mode: "reader",
  url: "https://example.com/article"
}
```

### 深度研究 `deep_research`

适合复杂问题检索，输入 `query`，支持 `fast`、`fast_thinking`、`ds-r1` 三个模型，内部会聚合流式响应并提取 citations。

```json5
{
  query: "比较不同 Agent 插件架构的优缺点",
  mode: "deep_research",
  model: "ds-r1"
}
```

提示：真实联调时建议仅通过环境变量注入 `METASO_API_KEY`，不要把秘钥写入仓库配置文件。

## 已知问题与故障排除

### 插件加载后找不到 `@sinclair/typebox`

在某些 OpenClaw 本地安装环境下，插件加载时可能报错 `Cannot find package '@sinclair/typebox'`。这是因为 OpenClaw 将该依赖内置在主包里，未向外暴露。

临时修复方法：创建 symlink 将插件的依赖路径指向 OpenClaw 内置的 typebox：

```bash
mkdir -p ~/.openclaw/extensions/openclaw-web-search/node_modules/@sinclair
ln -sf /opt/homebrew/lib/node_modules/openclaw/node_modules/@sinclair/typebox \
  ~/.openclaw/extensions/openclaw-web-search/node_modules/@sinclair/typebox
```

> 注：`/opt/homebrew/lib/node_modules/openclaw` 是 homebrew 安装路径，可用 `realpath $(which openclaw)` 推断实际位置。

### 搜索返回"未返回搜索结果"

如果 Metaso 始终返回空结果，请检查：

- `plugins.entries.openclaw-web-search.config.metaso.apiKey` 是否已正确配置。
- OpenClaw 配置中 `tools.web.search.provider` 是否设为 `metaso`。
- 升级到最新包后执行 `openclaw gateway restart`，清除旧缓存后重新搜索。

## 开发与验证

```bash
npm install
npm run check
npm test
```

## 开发文档

- [AI 开发指引（AGENTS.md）](./AGENTS.md)
- [变更日志（CHANGELOG.md）](./CHANGELOG.md)

提示：`docs/` 与 `openspec/` 目录默认作为本地工作资料保留，不参与当前 Git 发布内容。

## 许可证

本项目基于 [MIT](./LICENSE) 协议发布。

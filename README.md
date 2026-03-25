# openclaw-web-search

[![npm](https://img.shields.io/npm/v/@ww-ai-lab/openclaw-web-search)](https://www.npmjs.com/package/@ww-ai-lab/openclaw-web-search)
[![GitHub](https://img.shields.io/badge/GitHub-WW--AI--Lab%2Fopenclaw--web--search-blue)](https://github.com/WW-AI-Lab/openclaw-web-search)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

`openclaw-web-search` 是 [OpenClaw](https://github.com/openclaw/openclaw) 的独立外部插件，目标是逐步为 OpenClaw 接入国产大模型原生联网搜索能力，以及兼容 OpenAI 风格接口的第三方搜索服务。

当前版本聚焦于把国产搜索 Provider 做成可安装、可配置、可发布的独立 npm 包，后续会按路线图逐步扩展更多线路。

## 项目简介

这个插件不属于 OpenClaw 主仓库内置 `extensions/*`，而是作为外部插件发布：

- npm 包名：`@ww-ai-lab/openclaw-web-search`
- 插件 ID：`openclaw-web-search`
- 发布方式：`openclaw plugins install @ww-ai-lab/openclaw-web-search`
- 许可证：MIT

## 已支持与规划中的 Provider

| 提供商 | provider id | 状态 | 说明 |
|---|---|---|---|
| 通义百炼（DashScope） | `qwen` | 已实现 | 走 DashScope 原生协议，支持结构化来源与引用角标 |
| 豆包 / 火山引擎 ARK | `doubao` | 规划中 | 接入豆包原生搜索或兼容线路 |
| 秘塔搜索 | `metaso` | 规划中 | 适配秘塔搜索 API |
| 智普 GLM 搜索 | `zhipu` | 规划中 | 接入智普原生 Web 搜索能力 |
| OpenAI 兼容搜索服务 | `compatible` | 规划中 | 兼容更多带搜索能力的 OpenAI 风格接口 |

## 路线图

本项目按“先打通一条稳定可用线路，再逐步扩展国产搜索 Provider”的方式推进：

1. 第一阶段：完成 Qwen（DashScope 原生协议）接入，验证插件配置、缓存、错误处理、引用输出、npm 发布链路。
2. 第二阶段：增加豆包 / ARK 搜索适配，统一配置结构与凭据解析链。
3. 第三阶段：增加秘塔搜索与智普搜索，补充更多响应归一化测试。
4. 第四阶段：抽象更多共享基础设施，兼容更多 OpenAI 风格的搜索服务。
5. 第五阶段：完善 Provider 选择策略、文档、示例与自动化发布流程。

## 与 OpenClaw 内置 `openai-search` 的差异

以当前已实现的 Qwen 线路为例：

| 能力 | `openclaw-web-search`（qwen） | `openai-search` |
|---|---|---|
| 协议 | DashScope 原生协议 | OpenAI 兼容协议 |
| 搜索来源返回 | 支持结构化 `search_info` | 主要依赖文本解析 |
| 角标引用标注 | 支持 `enableCitation` | 不支持 |
| 搜索策略 | 支持 `turbo` / `max` | 不支持 |
| 强制搜索 | 支持 | 不支持 |
| 搜索时效性 | 支持 | 不支持 |
| 垂域搜索扩展 | 支持 | 不支持 |

两个插件可以共存，由 OpenClaw 的 Provider 选择逻辑自动决定优先级。

## 安装说明

### 前置要求

| 依赖 | 要求 |
|---|---|
| OpenClaw | `>= 2026.3.22` |
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

如果 OpenClaw 已正确加载插件，应能在插件列表中看到 `openclaw-web-search`，并在配置中看到 `qwen` 相关字段。

## 配置说明

当前已实现的是 Qwen（DashScope 原生协议）线路，支持三种配置方式。

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
        }
      }
    }
  }
}
```

### 方式三：环境变量

```bash
export DASHSCOPE_API_KEY="sk-..."
```

凭据优先级从高到低如下：

1. `plugins.entries.openclaw-web-search.config.qwen.apiKey`
2. `tools.web.search.qwen.apiKey`
3. `DASHSCOPE_API_KEY`

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

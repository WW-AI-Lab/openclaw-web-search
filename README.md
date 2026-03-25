# openclaw-web-search

[![npm](https://img.shields.io/npm/v/@ww-ai-lab/openclaw-web-search)](https://www.npmjs.com/package/@ww-ai-lab/openclaw-web-search)
[![GitHub](https://img.shields.io/badge/GitHub-WW--AI--Lab%2Fopenclaw--web--search-blue)](https://github.com/WW-AI-Lab/openclaw-web-search)

`openclaw-web-search` 是 [OpenClaw](https://github.com/openclaw/openclaw) 的独立外部插件，
专为扩展国产模型内置搜索和第三方搜索服务而设计。

## 支持的搜索提供商

| 提供商 | provider id | 状态 | 说明 |
|---|---|---|---|
| 通义百炼 (DashScope) | `qwen-dashscope` | **已实现** | 通过 DashScope 原生协议实现联网搜索，支持搜索来源返回与角标标注 |
| 豆包 | `doubao` | 开发中 | 字节跳动豆包 / 火山引擎 ARK 内置搜索 |
| 秘塔搜索 | `metaso` | 开发中 | 秘塔 AI 搜索，支持深度搜索 |
| 智普搜索 | `zhipu` | 开发中 | 智谱 GLM 内置 Web 搜索 |

## 通义百炼 Provider（DashScope 原生协议）

本插件的通义百炼 Provider 使用 **DashScope 原生协议**（而非 OpenAI 兼容协议），充分利用阿里云百炼平台的全部搜索能力。

### 与 `openai-search` 内置插件的差异

| 能力 | `openclaw-web-search` (qwen-dashscope) | `openai-search` |
|---|---|---|
| 协议 | DashScope 原生协议 | OpenAI 兼容协议 |
| 搜索来源返回 | 支持（结构化 `search_info`） | 不支持（正则匹配 URL） |
| 角标引用标注 | 支持（`enable_citation`） | 不支持 |
| Citations 质量 | 高（结构化 URL + 标题） | 中（正则猜测） |
| 搜索策略选择 | 支持（turbo/max） | 不支持 |
| 强制搜索 | 支持 | 不支持 |
| 搜索时效性 | 支持 | 不支持 |
| 垂域搜索 | 支持 | 不支持 |
| 深度思考模式 | 支持 | 支持 |
| `autoDetectOrder` | 50（更优先） | 55 |

两个插件可以共存，由 `autoDetectOrder` 自动选择优先的 Provider。

### 支持的模型

默认模型为 `qwen-plus`，可通过配置切换至其他支持联网搜索的模型：

- **千问 Max 系列**：`qwen3-max`、`qwen3-max-preview`、`qwen-max`、`qwen-max-latest`
- **千问 Plus 系列**：`qwen3.5-plus`、`qwen-plus`、`qwen-plus-latest`
- **千问 Flash 系列**：`qwen3.5-flash`、`qwen-flash`
- **千问 Turbo 系列**：`qwen-turbo`、`qwen-turbo-latest`
- **推理系列**：`qwq-plus`
- **第三方模型**：`deepseek-v3.2`、`deepseek-r1`、`deepseek-v3`、`Moonshot-Kimi-K2-Instruct`、`MiniMax-M2.1`

系统不对模型名称做强校验，允许使用 DashScope 平台未来新增的模型。

## 安装

### 从 npm 安装

```bash
openclaw plugins install @ww-ai-lab/openclaw-web-search
openclaw plugins enable openclaw-web-search
openclaw gateway restart
```

### 本地开发安装

```bash
git clone git@github.com:WW-AI-Lab/openclaw-web-search.git
cd openclaw-web-search
npm install

# 在 OpenClaw 主目录执行
openclaw plugins install -l /path/to/openclaw-web-search
openclaw plugins enable openclaw-web-search
openclaw gateway restart
```

## 配置

### 通义百炼（DashScope 原生协议）

**方式一：插件配置**（推荐）

```json5
{
  plugins: {
    entries: {
      "openclaw-web-search": {
        enabled: true,
        config: {
          qwen: {
            apiKey: "sk-...",
            model: "qwen-plus",           // 可选，默认 qwen-plus
            searchStrategy: "turbo",       // 可选，turbo（默认）/ max
            forcedSearch: false,           // 可选，是否强制搜索
            enableThinking: false,         // 可选，深度思考模式
            enableSearchExtension: false,  // 可选，垂域搜索
            enableSource: true,            // 可选，返回搜索来源（默认开启）
            enableCitation: false,         // 可选，角标引用标注
            citationFormat: "[<number>]",  // 可选，角标格式
            freshness: null,               // 可选，搜索时效性（7/30/180/365 天）
            timeoutSeconds: 30             // 可选，超时秒数
          }
        }
      }
    }
  }
}
```

**方式二：旧式搜索配置**（向后兼容）

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

**方式三：环境变量**

```bash
export DASHSCOPE_API_KEY="sk-..."
```

凭据优先级：插件配置 > 旧式搜索配置 > 环境变量。

### 搜索策略说明

| 策略 | 说明 |
|---|---|
| `turbo`（默认） | 轻量搜索，仅搜索一次，速度快 |
| `max` | 深度搜索，多次搜索并交叉验证，结果更准确 |

### 搜索时效性

通过 `freshness` 配置限定搜索结果的时间范围：

| 值 | 含义 |
|---|---|
| `7` | 最近 7 天 |
| `30` | 最近 30 天 |
| `180` | 最近 180 天 |
| `365` | 最近 1 年 |
| 不设置 | 不限制 |

## 最低版本要求

| 依赖 | 最低版本 |
|---|---|
| OpenClaw | `>= 2026.3.22` |
| Node.js | `>= 22` |

## 开发

```bash
# 安装依赖
npm install

# 类型检查
npm run check

# 运行测试
npm test
```

## 开发文档

- [开发最佳实践](./docs/开发最佳实践.md)
- [DashScope 搜索 curl 示例](./docs/dashscope-qwen搜索curl示例.md)
- [AI 开发指引（AGENTS.md）](./AGENTS.md)

## 贡献

欢迎提交 PR 和 Issue。在开始开发前，请先阅读 [AGENTS.md](./AGENTS.md)。

需求提案和任务管理通过 OpenSpec 管理（见 `openspec/` 目录），所有提案**必须以中文撰写**。

## 许可证

MIT

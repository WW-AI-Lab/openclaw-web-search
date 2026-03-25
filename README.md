# openclaw-web-search

[![npm](https://img.shields.io/npm/v/@ww-ai-lab/openclaw-web-search)](https://www.npmjs.com/package/@ww-ai-lab/openclaw-web-search)
[![GitHub](https://img.shields.io/badge/GitHub-WW--AI--Lab%2Fopenclaw--web--search-blue)](https://github.com/WW-AI-Lab/openclaw-web-search)

`openclaw-web-search` 是 [OpenClaw](https://github.com/openclaw/openclaw) 的独立外部插件，
专为扩展国产模型内置搜索和第三方搜索服务而设计。

## 支持的搜索提供商

| 提供商 | provider id | 说明 |
|---|---|---|
| 秘塔搜索 | `metaso` | 秘塔 AI 搜索，支持深度搜索 |
| 千问搜索 | `qwen` | 通义千问 / DashScope 内置联网搜索 |
| 豆包 | `doubao` | 字节跳动豆包 / 火山引擎 ARK 内置搜索 |
| 智普搜索 | `zhipu` | 智谱 GLM 内置 Web 搜索 |

> 当前版本（`0.1.0`）为插件骨架，上述 provider 正在开发中。

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

在 OpenClaw 配置文件（`~/.openclaw/config.json5`）中添加以下内容：

### 秘塔搜索

```json5
{
  tools: {
    web: {
      search: {
        provider: "metaso",
        metaso: {
          apiKey: "your-metaso-api-key"
        }
      }
    }
  }
}
```

或通过环境变量：

```bash
export METASO_API_KEY="your-metaso-api-key"
```

### 千问搜索（DashScope）

```json5
{
  tools: {
    web: {
      search: {
        provider: "qwen",
        qwen: {
          apiKey: "sk-...",
          model: "qwen-plus"   // 可选，默认 qwen-plus
        }
      }
    }
  }
}
```

或通过环境变量：

```bash
export DASHSCOPE_API_KEY="sk-..."
```

### 豆包

```json5
{
  tools: {
    web: {
      search: {
        provider: "doubao",
        doubao: {
          apiKey: "your-ark-api-key",
          model: "doubao-pro-32k"   // 可选
        }
      }
    }
  }
}
```

或通过环境变量：

```bash
export DOUBAO_API_KEY="your-api-key"
# 或
export ARK_API_KEY="your-ark-api-key"
```

### 智普搜索

```json5
{
  tools: {
    web: {
      search: {
        provider: "zhipu",
        zhipu: {
          apiKey: "your-zhipu-api-key",
          model: "glm-4-plus"   // 可选
        }
      }
    }
  }
}
```

或通过环境变量：

```bash
export ZHIPU_API_KEY="your-zhipu-api-key"
```

## 插件配置（通过 Plugin Entry 配置）

也可以在插件入口直接配置凭据：

```json5
{
  plugins: {
    entries: {
      "openclaw-web-search": {
        enabled: true,
        config: {
          webSearch: {
            apiKey: "your-api-key",
            provider: "metaso"
          }
        }
      }
    }
  }
}
```

## 最低版本要求

| 依赖 | 最低版本 |
|---|---|
| OpenClaw | `>= 2026.3.22` |
| Node.js | `>= 22` |

## 开发文档

- [开发最佳实践](./docs/开发最佳实践.md)
- [AI 开发指引（AGENTS.md）](./AGENTS.md)

## 贡献

欢迎提交 PR 和 Issue。在开始开发前，请先阅读 [AGENTS.md](./AGENTS.md)。

需求提案和任务管理通过 OpenSpec 管理（见 `openspec/` 目录），所有提案**必须以中文撰写**。

## 许可证

MIT

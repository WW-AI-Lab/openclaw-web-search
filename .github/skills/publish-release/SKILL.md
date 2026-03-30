---
name: publish-release
description: Full release workflow for openclaw-web-search. Use when the user wants to publish a new version to npm and GitHub. Triggers include: "发布新版本", "publish release", "打包发布", "推送 npmjs", "出一个版本", "release", or any mention of publishing/releasing this plugin. ALWAYS use this skill instead of making up a release process from scratch — this captures the exact conventions and security requirements for this project.
---

# openclaw-web-search 发布规范

完整的版本发布流程，按顺序执行以下各步骤。

---

## 0. 准备工作

1. 确认当前目录为项目根目录 `/path/to/openclaw-web-search/`
2. 确认工作树干净或只有预期修改：`git status --short`  
3. 确认当前分支为 `main`：`git branch --show-current`
4. 确认版本号（今日日期格式 `YYYY.M.D`，例如 `2026.3.30`）

---

## 1. 安全检查（必做，不可跳过）

### 1.1 扫描真实 API Key

```bash
# 扫描已跟踪文件中的秘钥格式
git grep -rn "mk-[A-Z0-9]\{30,\}" -- ':!*.test.ts'
git grep -rn "sk-[A-Za-z0-9]\{20,\}" -- ':!*.test.ts'

# 扫描 git 历史
git log --all -p | grep -E "mk-[A-Z0-9]{30,}|sk-[A-Za-z0-9]{20,}" | head -5
```

**预期**：无输出（无匹配）。如有输出，**立即停止**，清理泄露的秘钥后再继续。

### 1.2 检查 .env 文件是否已 gitignore

```bash
ls -la .env* 2>&1
git check-ignore -v .env .env.local 2>&1
```

**预期**：无 `.env*` 文件存在，或已被 `.gitignore` 排除。

### 1.3 验证测试文件中的 key 均为占位符

```bash
grep -rn "apiKey.*\"" src/ | grep -v "mk-test\|sk-test\|placeholder\|vi.fn\|mockReturnValue\|searchConfig"
```

**预期**：无真实 key 格式的输出。

---

## 2. 运行测试

```bash
npm test
```

**预期**：所有测试通过（`Tests X passed (X)`）。失败则修复后再继续。

也运行类型检查：

```bash
npm run check
```

**预期**：无输出（无 TypeScript 错误）。

---

## 3. 更新版本号

版本号格式为 `YYYY.M.D`（例如 `2026.3.30`）。

3.1 更新 `package.json` 中的 `version` 字段。

3.2 如果当前 `version` 已是今日日期，且尚未在 npm 上发布，则直接跳过（无需更改）。

3.3 确认 npm 上不存在同版本：

```bash
npm view @ww-ai-lab/openclaw-web-search versions --json
```

---

## 4. 更新 CHANGELOG.md

在 `CHANGELOG.md` 文件顶部新增版本章节。重要规则：

- **日期**：`## YYYY.M.D`
- **内容**：条目列表（`-`），说明本版本的新功能、修复和变更
- **语言**：中文
- **不要删除**旧版本的内容

---

## 5. 更新 README.md（如有必要）

检查以下内容是否需要更新：

- Provider 支持表格（`已实现` / `规划中` 状态）
- 路线图（标记已完成阶段为 ✅）
- 故障排除章节（新增已知问题说明）
- 安装说明（更新版本要求说明）

---

## 6. 验证 npm 打包内容

```bash
npm pack --dry-run
```

**检查清单**：

- [ ] 无 `*.test.ts` 文件
- [ ] 无 `.env*` 文件
- [ ] 无 `node_modules/`
- [ ] 无 `openspec/`、`docs/`、`AGENTS.md`
- [ ] 包含：`index.ts`、`src/providers/**/*-provider.ts`、`src/providers/shared/*.ts`、`openclaw.plugin.json`、`README.md`、`CHANGELOG.md`

**如发现测试文件**：更新 `package.json` 的 `files` 字段为精确文件列表（而非简单的 `"src"`），确保仅列生产代码文件。

> 注意：`files` 字段是白名单，`.npmignore` 对 `files` 白名单内的目录**不生效**；必须在 `files` 字段中精确控制。

---

## 7. 提交发布前变更

如有文件修改（README、CHANGELOG、package.json 等），先提交：

```bash
git add README.md CHANGELOG.md package.json .npmignore   # 按实际修改文件
git commit -m "chore: prepare v<VERSION> release

- 简述本版本的主要变更"
```

---

## 8. 发布到 npm

```bash
npm publish --access public
```

**预期输出包含**：`+ @ww-ai-lab/openclaw-web-search@<VERSION>`

如遇 `403 Forbidden`，检查 npm 登录状态：`npm whoami`

---

## 9. 打 Tag 并推送 GitHub

```bash
git tag v<VERSION>
git push origin main
git push origin v<VERSION>
```

**预期**：`main` 分支和 tag 均推送成功。

---

## 10. 创建 GitHub Release

将 release notes 写入临时文件（避免多行字符串在 shell 中的编码问题），再调用 `gh`：

```bash
cat > /tmp/release-notes-<VERSION>.md << 'NOTES'
## 新增功能

### （在这里描述新功能）

## 问题修复

### 修复：（在这里描述修复内容）

## 其他变更

- （条目列表）

## 安装

```bash
openclaw plugins install @ww-ai-lab/openclaw-web-search
openclaw plugins enable openclaw-web-search
openclaw gateway restart
```

**要求 OpenClaw >= 2026.3.28**

## npm

[@ww-ai-lab/openclaw-web-search@<VERSION>](https://www.npmjs.com/package/@ww-ai-lab/openclaw-web-search/v/<VERSION>)
NOTES

gh release create v<VERSION> \
  --title "v<VERSION> - <简短标题>" \
  --notes-file /tmp/release-notes-<VERSION>.md \
  --repo WW-AI-Lab/openclaw-web-search
```

**验证**：

```bash
gh release list --repo WW-AI-Lab/openclaw-web-search | head -3
```

---

## 11. 验证发布结果

```bash
# 验证 npm
npm view @ww-ai-lab/openclaw-web-search versions --json

# 验证 GitHub release
gh release view v<VERSION> --repo WW-AI-Lab/openclaw-web-search
```

---

## 常见问题

### npm publish 403
- `npm whoami` 确认已登录
- `npm login` 重新认证

### gh release create 无输出
- 检查 tag 是否已推送：`git ls-remote origin v<VERSION>`
- 检查 `gh auth status`

### 版本已存在于 npm
- npm 版本不可覆盖发布，需改用新版本号（如同日发布多次可用 `YYYY.M.D-1`）

### @sinclair/typebox 插件加载失败
参见 README 故障排除章节，创建 symlink 解决。

---

## 快速参考：版本号规范

| 场景 | 版本示例 |
|---|---|
| 常规功能发布 | `2026.3.30` |
| 同日第二次发布 | `2026.3.30-1` |
| Beta 版 | `2026.3.30-beta.1` |

版本格式应始终与 OpenClaw 主体版本风格保持一致。

# ai-stats

> AIGC code statistics & annotation tool for [Claude Code](https://claude.ai/code). Insert/update comments in source files to track AI-generated code — tool, author, line count, and date.

> AIGC 代码统计标注工具，为 [Claude Code](https://claude.ai/code) 设计。在源文件头部插入/更新注释，记录 AI 工具、作者、行数、日期。

![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Annotation Format / 标注格式

```python
# AIGC:claude|author:lisi|lines:28|dates:2025-04
```

| Field | Description | Example |
|-------|-------------|---------|
| AIGC | Fixed prefix | `AIGC` |
| tool | AI tool name | `cursor`, `copilot`, `claude` |
| author | Developer name | `lisi`, `zhangsan` |
| lines | AI-generated line count | `28` |
| dates | Annotation date YYYY-MM | `2025-04` |

---

## Installation / 安装

### 1. Clone / 克隆

```bash
git clone https://github.com/ahyk/ai-stats.git
```

### 2. Install to Claude Code / 安装到 Claude Code

**Global (all projects) / 全局安装：**

```bash
cp -r ai-stats ~/.claude/skills/ai-stats
```

**Per-project / 单项目安装：**

```bash
cp -r ai-stats /your/project/.claude/skills/ai-stats
```

Claude Code auto-discovers skills from `.claude/skills/*/SKILL.md`.

---

## Usage / 使用方式

### Via Claude Code (recommended)

Just describe what you want in natural language:

- `帮我标注 AIGC` / `annotate AI code stats`
- `统计 AI 代码占比` / `AI code ratio report`
- `移除所有 AIGC 注释` / `remove all AIGC annotations`

### Via CLI / 命令行

```bash
cd ~/.claude/skills/ai-stats

# Annotate staged (git add) files / 标注 git add 后的文件
node scripts/ai_stats.js

# Scan entire repo / 全量扫描仓库
node scripts/ai_stats.js --all-files

# Dry run (stats only, no modification) / 仅统计不修改
node scripts/ai_stats.js --dry-run

# Specify tool & author / 指定工具和作者
node scripts/ai_stats.js --tool copilot --author zhangsan

# Remove all AIGC comments / 移除所有 AIGC 注释
node scripts/ai_stats.js --remove
```

---

## Two Modes / 两种模式

### Change Mode (default) / 变更模式（默认）

Uses `git diff --numstat` to count insertions in changed files.

### All-files Mode / 全文件模式 (`--all-files`)

Recursively scans all code files in the repo.

Auto-skips: `.git`, `node_modules`, `vendor`, `__pycache__`, `.venv`, `dist`, `build`

---

## Parameters / 参数

```
--all-files, -a    Scan all code files in repo (not just changed)
--scope, -s <s>    Change mode scope: working | staged | committed | all (default: staged)
--tool, -t <name>  AI tool name (default: cursor)
--author <name>    Author name (default: git user.name)
--dry-run, -n      Stats only, no file modification
--remove, -r       Remove all existing AIGC annotations
-v, --verbose      Verbose output
--json             JSON output
-h, --help         Show help
```

---

## Supported Languages / 支持的语言

| Language | Extensions | Comment Style |
|----------|-----------|---------------|
| Python | `.py` | `# AIGC:...` |
| JS/TS | `.js`, `.ts`, `.jsx`, `.tsx` | `// AIGC:...` |
| Go / Rust / Java / C / C++ | `.go`, `.rs`, `.java`, `.c`, `.cpp` | `// AIGC:...` |
| PHP | `.php` | `// AIGC:...` |
| Shell | `.sh`, `.bash`, `.zsh` | `# AIGC:...` |
| SQL | `.sql`, `.mysql` | `-- AIGC:...` |
| Lua | `.lua` | `-- AIGC:...` |
| HTML / Vue / Svelte | `.html`, `.vue`, `.svelte` | `<!-- AIGC:... -->` |
| CSS / SCSS / Less | `.css`, `.scss`, `.less` | `/* AIGC:... */` |
| Ruby | `.rb` | `# AIGC:...` |
| Kotlin / Swift / C# / Scala / Dart | `.kt`, `.swift`, `.cs`, `.scala`, `.dart` | `// AIGC:...` |
| Makefile | `Makefile` | `# AIGC:...` |
| Dockerfile | `Dockerfile` | `# AIGC:...` |

Auto-skipped: binary files, `.min.js` / `.min.css`, files with no comment style, empty files.

---

## Requirements / 环境要求

- Node.js >= 18
- git (for change mode)
- Cross-platform: macOS / Linux / Windows

---

## License

[MIT](./LICENSE)

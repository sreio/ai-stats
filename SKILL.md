---
name: ai-stats
description: AIGC 代码统计标注工具。在每个代码文件头部插入 AIGC 注释标注 AI 工具、作者、行数、日期；已有 AIGC 注释时追加新行并保留历史。支持扫描变更文件或全量扫描仓库。支持 PHP、JS、HTML、Python、Go、Shell、MySQL、Vue、TypeScript、Java、Rust、C/C++ 等主流语言。当用户提到 AIGC 统计、AI 代码标注、AI 生成行数、代码贡献标注、提交前标注、AI 占比时使用。跨平台支持 macOS/Linux/Windows。
license: MIT
compatibility: node>=18
user-invocable: true
disable-model-invocation: false
allowed-tools: Bash, Read, Grep, Glob
argument-hint: [--all-files] [--scope working|staged|committed] [--tool name] [--author name] [--dry-run] [--remove]
---

# AIGC 代码统计标注


## 核心原则

```
每一段 AI 生成的代码都应有据可查
标注 = 透明度 + 可追溯性 + 责任归属
```

## 标注格式

```
AIGC:cursor|author:lisi|lines:28|dates:2025-04
```

| 字段 | 说明 | 示例 |
|------|------|------|
| **AIGC** | 固定前缀 | `AIGC` |
| **AI 工具** | 使用的 AI 工具名 | `cursor`, `copilot`, `claude` |
| **author** | 作者/开发者用户名 | `lisi`, `zhangsan` |
| **lines** | AI 生成的代码行数 | `28` |
| **dates** | 标注日期 YYYY-MM | `2025-04` |

## 自动分析

运行统计脚本（跨平台，Node.js 驱动）：

```bash
# 在项目根目录下运行

# --- 变更模式（默认）：仅处理 git 变更文件 ---
node scripts/ai_stats.js                              # 标注所有变更文件
node scripts/ai_stats.js --scope staged               # 仅处理暂存区
node scripts/ai_stats.js --scope committed            # 仅处理最近一次提交
node scripts/ai_stats.js --scope working              # 仅处理工作区变更

# --- 全文件模式：扫描仓库中所有代码文件 ---
node scripts/ai_stats.js --all-files                  # 全量扫描并标注
node scripts/ai_stats.js --all-files --dry-run        # 全量扫描仅统计

# --- 参数 ---
node scripts/ai_stats.js --tool copilot               # 指定 AI 工具 (默认: cursor)
node scripts/ai_stats.js --author zhangsan            # 指定作者 (默认: git user.name)
node scripts/ai_stats.js --dry-run                    # 仅统计，不修改文件
node scripts/ai_stats.js --remove                     # 移除所有 AIGC 注释
node scripts/ai_stats.js -v                           # 详细模式
node scripts/ai_stats.js --json                       # JSON 输出
```

## 两种模式

### 变更模式（默认）

通过 `git diff --numstat` 统计每个变更文件的 insertions。

```
git diff --numstat → insertions → 写入 AIGC 注释
```

### 全文件模式 (--all-files)

递归扫描仓库中所有代码文件，统计每个文件的总行数。

```
递归遍历目录 → 过滤代码文件 → countLines() → 写入 AIGC 注释
```

自动跳过 `.git`、`node_modules`、`vendor`、`__pycache__`、`.venv`、`dist`、`build` 等目录。

## 触发流程

### 场景一：代码提交前

```
用户说 "帮我提交代码" / "commit" / "提交前检查"
  ↓
1. /ai-stats                      → AIGC 标注所有变更文件
  ↓
2. git commit
```

### 场景二：项目审计 / AIGC 审查

```
用户说 "统计 AI 代码占比" / "AIGC 审计" / "看看 AI 生成了多少代码"
  ↓
/ai-stats --dry-run               → 扫描变更文件预览
  ↓
确认无误后
  ↓
/ai-stats                         → 标注变更文件
```

### 场景三：日常开发（仅标注变更文件）

```
用户说 "标注一下" / "AI 标注" / "打上 AIGC 标记"
  ↓
/ai-stats                         → 标注 git 变更文件
```

### 场景四：清理标注

```
用户说 "去掉 AI 注释" / "移除标注" / "清理 AIGC"
  ↓
/ai-stats --remove                → 移除所有 AIGC 注释
```

### 场景五：PR/MR 审查

```
用户说 "审查 AI 代码参与度" / "PR 检查 AI 贡献"
  ↓
/ai-stats --scope committed       → 标注最近一次提交
```

## 关键词自动触发

当对话中出现以下关键词时，自动调用本工具：

| 关键词 | 动作 |
|--------|------|
| AI 统计、AIGC 标注、AI 代码占比 | `node scripts/ai_stats.js` |
| AI 生成行数、AI 贡献、代码标注 | `node scripts/ai_stats.js` |
| 提交前标注、commit 前标注 | `node scripts/ai_stats.js` |
| 移除 AI 注释、清理 AIGC | `node scripts/ai_stats.js --remove` |
| AI 代码审查、AIGC 审计 | `node scripts/ai_stats.js --dry-run` |

## 标注行为

### 插入位置

- **普通文件** — 文件第一行
- **含 shebang 的脚本** — shebang 之后（第二行）

### 更新逻辑

- 文件中无 AIGC 注释 → 在头部插入一行
- 文件中已有 AIGC 注释 → 始终在最后一条 AIGC 之后**追加新的一行**（保留历史轨迹，不修改已有行）
- 若本次将写入的内容与最后一条 AIGC 完全一致 → 跳过（避免重复运行产生重复行）

### 注释风格（按语言自动匹配）

| 语言 | 扩展名 | 注释风格 |
|------|--------|----------|
| Python | `.py` | `# AIGC:cursor\|author:x\|lines:28\|dates:2025-04` |
| JS/TS | `.js`, `.ts`, `.jsx`, `.tsx` | `// AIGC:...` |
| Go/Rust/Java/C/C++ | `.go`, `.rs`, `.java`, `.c`, `.cpp` | `// AIGC:...` |
| PHP | `.php` | `// AIGC:...` |
| Shell | `.sh`, `.bash`, `.zsh` | `# AIGC:...` |
| SQL/MySQL | `.sql`, `.mysql` | `-- AIGC:...` |
| Lua | `.lua` | `-- AIGC:...` |
| HTML/Vue | `.html`, `.vue`, `.svelte` | `<!-- AIGC:... -->` |
| CSS/SCSS/Less | `.css`, `.scss`, `.less` | `/* AIGC:... */` |
| Ruby | `.rb` | `# AIGC:...` |
| Kotlin/Swift/C#/Scala/Dart | `.kt`, `.swift`, `.cs`, `.scala`, `.dart` | `// AIGC:...` |
| Makefile | `Makefile` | `# AIGC:...` |
| Dockerfile | `Dockerfile` | `# AIGC:...` |

### 跳过规则

- 二进制文件（图片、音视频、压缩包、字体、可执行文件等）
- `.min.js` / `.min.css` 压缩文件
- 无法识别注释风格的文件
- 行数为 0 的空文件

## 跨平台兼容性

| 平台 | 兼容性 |
|------|--------|
| macOS | ✅ |
| Linux | ✅ |
| Windows | ✅ |

所有操作通过 Node.js API 完成，自动处理路径分隔符差异。

## 报告格式

```
============================================================
AIGC 代码统计报告
============================================================
扫描文件数: 119
已标注: 108 新增
跳过: 11

----------------------------------------
文件明细:
----------------------------------------
  + app/clients/minimax_client.py (309 行)
  + app/config.py (90 行)
  + app/services/audio_service.py (260 行)
  + app/utils/video_annotator.py (1005 行)
  - app/__init__.py (0 lines)
  - CLAUDE.md (no comment style for .md)
============================================================
```

## 目录结构

```
ai-stats/
├── SKILL.md            # 技能定义（本文件）
├── README.md           # 使用说明
├── lib/
│   └── shared.js       # 共享工具函数
└── scripts/
    └── ai_stats.js     # 核心脚本
```

## 安装

将本仓库克隆到 Claude Code 技能目录：

```bash
# 全局安装（所有项目可用）
git clone https://github.com/ahyk/ai-stats.git ~/.claude/skills/ai-stats

# 或单项目安装
git clone https://github.com/ahyk/ai-stats.git /your/project/.claude/skills/ai-stats
```

## 环境要求

- Node.js >= 18
- git（变更模式需要）
- 跨平台: macOS / Linux / Windows

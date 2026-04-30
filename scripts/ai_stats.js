#!/usr/bin/env node
"use strict";

/**
 * AIGC 代码统计标注工具
 *
 * 在每个文件头部插入 AIGC 注释：
 *   AIGC:cursor|author:用户名|lines:行数|dates:YYYY-MM
 *
 * 两种模式：
 *   1. 变更模式 (默认) — git diff --numstat 统计变更文件的 insertions
 *   2. 全文件模式 (--all-files) — 扫描仓库中所有代码文件，统计总行数
 *
 * 支持平台: macOS / Linux / Windows
 * 支持语言: PHP, JS, HTML, Python, Go, Shell, MySQL, Vue, TypeScript, Java,
 *           C/C++, Rust, Ruby, Kotlin, Swift, C#, Scala, Lua, R, Dart 等
 */

const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { DASH, SEP } = require(path.join(__dirname, '..', 'lib', 'shared.js'));

// ---- 注释风格定义 ----

const SINGLE_LINE = {
  ".py": "# ", ".sh": "# ", ".bash": "# ", ".zsh": "# ", ".fish": "# ",
  ".ps1": "# ", ".rb": "# ", ".r": "# ", ".pl": "# ",
  ".lua": "-- ", ".sql": "-- ", ".mysql": "-- ",
  ".rs": "// ", ".go": "// ", ".js": "// ", ".jsx": "// ",
  ".ts": "// ", ".tsx": "// ", ".java": "// ",
  ".c": "// ", ".cpp": "// ", ".h": "// ", ".hpp": "// ",
  ".cs": "// ", ".swift": "// ", ".kt": "// ", ".kts": "// ",
  ".scala": "// ", ".dart": "// ", ".groovy": "// ", ".php": "// ",
  ".css": "/* ", ".less": "/* ", ".scss": "/* ", ".sass": "/* ", ".styl": "// ",
};

const MULTI_LINE = {
  ".css":  { open: "/* ", close: " */" },
  ".less": { open: "/* ", close: " */" },
  ".scss": { open: "/* ", close: " */" },
  ".sass": { open: "/* ", close: " */" },
};

const FILENAME_MAP = {
  "makefile": "# ", "makefile.win": "# ", "dockerfile": "# ",
  "rakefile": "# ", "gemfile": "# ", "procfile": "# ", "vagrantfile": "# ",
  "jenkinsfile": "// ",
  ".gitignore": "# ", ".dockerignore": "# ", ".env": "# ", ".env.example": "# ",
};

const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp",
  ".mp3", ".mp4", ".avi", ".mov", ".wav", ".flac",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".exe", ".dll", ".so", ".dylib",
  ".map", ".lock", ".DS_Store",
]);

// 可扫描的代码扩展名集合
const CODE_EXT = new Set(Object.keys(SINGLE_LINE).concat(Object.keys(MULTI_LINE), [".vue", ".svelte", ".html", ".htm"]));
// 文件名也算代码
const CODE_FILENAMES = new Set(Object.keys(FILENAME_MAP));

// AIGC 注释正则 — 匹配各种注释风格包裹的 AIGC 行
const AIGC_REGEX = /^\s*(?:#|\/\/|--|\/\*\s*|<!--\s*)\s*AIGC:.*?\|lines:\d+\|.*$/;

// ---- 核心函数 ----

function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30000 });
  } catch {
    return "";
  }
}

function isGitRepo() {
  return git("rev-parse", "--is-inside-worktree").trim() === "true";
}

function getRepoRoot() {
  return git("rev-parse", "--show-toplevel").trim();
}

function getGitAuthor() {
  try {
    const name = execFileSync("git", ["config", "user.name"], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    return name || "unknown";
  } catch {
    return "unknown";
  }
}

function getCurrentDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCommentStyle(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  if (FILENAME_MAP[base]) return { prefix: FILENAME_MAP[base], close: "" };
  if (ext === ".vue" || ext === ".svelte") return { prefix: "<!-- ", close: " -->" };
  if (ext === ".html" || ext === ".htm") return { prefix: "<!-- ", close: " -->" };
  if (MULTI_LINE[ext]) return { prefix: MULTI_LINE[ext].open, close: MULTI_LINE[ext].close };
  if (SINGLE_LINE[ext]) return { prefix: SINGLE_LINE[ext], close: "" };
  return null;
}

function shouldSkip(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (SKIP_EXT.has(ext)) return true;
  const base = path.basename(filePath).toLowerCase();
  if (base.endsWith(".min.js") || base.endsWith(".min.css")) return true;
  return false;
}

function isCodeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  return CODE_EXT.has(ext) || CODE_FILENAMES.has(base);
}

function makeAigcComment(aiTool, author, lines, dateStr, style) {
  const text = `AIGC:${aiTool}|author:${author}|lines:${lines}|dates:${dateStr}`;
  return `${style.prefix}${text}${style.close || ""}`;
}

function parseAigcComment(line) {
  const match = line.match(/AIGC:([^|]+)\|author:([^|]+)\|lines:(\d+)\|dates:([^|\s]+)/);
  if (!match) return null;
  return { aiTool: match[1], author: match[2], lines: parseInt(match[3], 10), date: match[4] };
}

function isAigcLine(line) {
  return AIGC_REGEX.test(line);
}

// ---- 变更模式 ----

function getChangedInsertionsMap(scope) {
  const result = {};

  if (scope === "staged") {
    for (const line of git("diff", "--cached", "--numstat").split("\n")) {
      const parts = line.split("\t");
      if (parts.length >= 3 && parts[0] !== "-") {
        const ins = parseInt(parts[0], 10);
        if (ins > 0) result[parts[2]] = ins;
      }
    }
  } else if (scope === "committed") {
    for (const line of git("diff", "--numstat", "HEAD~1", "HEAD").split("\n")) {
      const parts = line.split("\t");
      if (parts.length >= 3 && parts[0] !== "-") {
        const ins = parseInt(parts[0], 10);
        if (ins > 0) result[parts[2]] = ins;
      }
    }
  } else {
    // working 或 all：统计 unstaged 改动
    for (const line of git("diff", "--numstat").split("\n")) {
      const parts = line.split("\t");
      if (parts.length >= 3 && parts[0] !== "-") {
        const ins = parseInt(parts[0], 10);
        if (ins > 0) result[parts[2]] = (result[parts[2]] || 0) + ins;
      }
    }
    // all 额外统计 staged 和未跟踪文件
    if (scope === "all") {
      for (const line of git("diff", "--cached", "--numstat").split("\n")) {
        const parts = line.split("\t");
        if (parts.length >= 3 && parts[0] !== "-") {
          const ins = parseInt(parts[0], 10);
          if (ins > 0) result[parts[2]] = (result[parts[2]] || 0) + ins;
        }
      }
      for (const f of git("ls-files", "--others", "--exclude-standard").split("\n")) {
        const file = f.trim();
        if (!file) continue;
        try {
          const lines = fs.readFileSync(file, "utf8").split("\n").length;
          if (lines > 0) result[file] = (result[file] || 0) + lines;
        } catch { /* skip */ }
      }
    }
  }
  return result;
}

function getChangedFiles(scope) {
  const files = new Set();
  if (scope === "staged" || scope === "all") {
    for (const line of git("diff", "--cached", "--name-only").split("\n")) {
      if (line.trim()) files.add(line.trim());
    }
  }
  if (scope === "working" || scope === "all") {
    for (const line of git("diff", "--name-only").split("\n")) {
      if (line.trim()) files.add(line.trim());
    }
  }
  if (scope === "all") {
    for (const line of git("ls-files", "--others", "--exclude-standard").split("\n")) {
      if (line.trim()) files.add(line.trim());
    }
  }
  if (scope === "committed") {
    for (const line of git("diff", "--name-only", "HEAD~1", "HEAD").split("\n")) {
      if (line.trim()) files.add(line.trim());
    }
  }
  return [...files];
}

// ---- 全文件模式 ----

function getAllCodeFiles(dir, baseDir) {
  baseDir = baseDir || dir;
  const results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if ([".", "..", ".git", "node_modules", "vendor", "__pycache__", ".venv", "venv", "dist", "build", ".idea", ".vscode"].includes(entry.name)) continue;
      results.push(...getAllCodeFiles(fullPath, baseDir));
      continue;
    }
    if (shouldSkip(relPath)) continue;
    if (!isCodeFile(relPath)) continue;
    results.push(relPath);
  }
  return results;
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    return lines.length;
  } catch { return 0; }
}

// ---- 标注逻辑 ----

/**
 * 找到 AIGC 注释的插入位置。
 * 跳过文件头部的语法必需行（<?php, #! 等）、声明行（package, import）、注释块、装饰器。
 */
function findInsertPoint(lines, ext) {
  let i = 0;
  const lowerExt = ext.toLowerCase();

  const skipBlanks = () => { while (i < lines.length && lines[i].trim() === "") i++; };

  skipBlanks();

  // 1. Shebang
  if (i < lines.length && lines[i].startsWith("#!")) i++;

  // 2. 语法致命行 — 特定语言
  if (lowerExt === ".php" && i < lines.length && /^<\?(php|=)/.test(lines[i].trim())) i++;
  if (i < lines.length && /^<\?xml/i.test(lines[i].trim())) i++;
  if (i < lines.length && /^<!DOCTYPE/i.test(lines[i].trim())) i++;
  if ((lowerExt === ".py" || lowerExt === ".rb") && i < lines.length
      && /^#\s*-\*-\s*coding/i.test(lines[i].trim())) i++;
  if (lowerExt === ".rb" && i < lines.length
      && /^#\s*frozen_string_literal/i.test(lines[i].trim())) i++;
  if (lowerExt === ".ps1" && i < lines.length
      && /^#\s*requires/i.test(lines[i].trim())) i++;

  // 3. 跳过连续的前导注释块（版权头、许可证、JSDoc 等）
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "") { i++; continue; }

    // 单行注释: //, #, --
    if (/^(\/\/|#|--)(\s|$)/.test(line)) { i++; continue; }

    // HTML 注释 <!-- ... -->
    if (/^<!--/.test(line)) {
      if (!/-->/.test(line)) {
        while (i < lines.length && !/-->/.test(lines[i])) i++;
      }
      i++;
      continue;
    }

    // 多行注释 /* ... */
    if (/^\/\*/.test(line)) {
      if (!/\*\//.test(line)) {
        while (i < lines.length && !/\*\//.test(lines[i])) i++;
      }
      i++;
      continue;
    }

    break;
  }

  skipBlanks();

  // 4. "use strict"（注释块之后检查）
  if (/^\.(js|jsx|ts|tsx|mjs|cjs)$/.test(lowerExt) && i < lines.length
      && /^["']use strict["'];?\s*$/.test(lines[i].trim())) i++;

  // 5. 跳过连续的前导声明行（package, import, using, require, library, declare, extern crate 等）
  //    和注解/装饰器（@xxx, [Attribute]）— 两者可交替出现
  const DECL_RE = /^(package\s|import\s|using\s|require\s|library\s|declare\s|extern\s+crate\s|crate_type\s)/;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "") { i++; continue; }
    if (DECL_RE.test(line)) { i++; continue; }
    if (/^@[\w.]/.test(line) || /^\[[\w.]/.test(line)) { i++; continue; }
    break;
  }

  skipBlanks();
  return i;
}

function annotateFile(filePath, aiLines, aiTool, author, dateStr, dryRun) {
  if (shouldSkip(filePath)) return { action: "skipped", reason: "binary/unsupported" };

  const style = getCommentStyle(filePath);
  if (!style) return { action: "unsupported", reason: `no comment style for ${path.extname(filePath) || path.basename(filePath)}` };

  let content;
  try { content = fs.readFileSync(filePath, "utf8"); }
  catch (err) { return { action: "skipped", reason: `cannot read: ${err.message}` }; }

  const lines = content.split("\n");
  const commentLine = makeAigcComment(aiTool, author, aiLines, dateStr, style);

  let lastAigcIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (isAigcLine(lines[i])) lastAigcIndex = i;
  }

  if (lastAigcIndex >= 0) {
    if (lines[lastAigcIndex].trim() === commentLine.trim()) {
      return { action: "skipped", reason: "duplicate", count: aiLines };
    }
    if (!dryRun) {
      lines.splice(lastAigcIndex + 1, 0, commentLine);
      fs.writeFileSync(filePath, lines.join("\n"), "utf8");
    }
    return { action: "added", newCount: aiLines, appended: true };
  }

  const insertAt = findInsertPoint(lines, path.extname(filePath));
  if (!dryRun) {
    lines.splice(insertAt, 0, commentLine);
    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  }
  return { action: "added", newCount: aiLines };
}

function removeAnnotation(filePath) {
  if (shouldSkip(filePath)) return { action: "skipped", reason: "binary" };

  let content;
  try { content = fs.readFileSync(filePath, "utf8"); }
  catch (err) { return { action: "skipped", reason: err.message }; }

  const lines = content.split("\n");
  const newLines = lines.filter(line => !isAigcLine(line));

  if (newLines.length === lines.length) return { action: "skipped", reason: "no AIGC annotation found" };

  fs.writeFileSync(filePath, newLines.join("\n"), "utf8");
  return { action: "removed" };
}

// ---- 报告格式化 ----

function formatReport(results, totalFiles, verbose) {
  const added = results.filter(r => r.action === "added").length;
  const skipped = results.filter(r => r.action === "skipped" || r.action === "unsupported").length;

  let report = "";
  report += SEP + "\n";
  report += "AIGC 代码统计报告\n";
  report += SEP + "\n";
  report += `扫描文件数: ${totalFiles}\n`;
  report += `已标注: ${added} 新增\n`;
  report += `跳过: ${skipped}\n`;

  if (!results.length) {
    report += "\n没有发现需要处理的文件\n";
    report += SEP + "\n";
    return report;
  }

  report += "\n" + DASH + "\n";
  report += "文件明细:\n";
  report += DASH + "\n";

  const icons = { added: "+", updated: "~", skipped: "-", unsupported: "?" };
  for (const r of results) {
    const icon = icons[r.action] || " ";
    let detail = "";
    if (r.action === "updated") detail = ` (旧: ${r.oldCount} → 新: ${r.newCount})`;
    else if (r.action === "added") detail = ` (${r.newCount} 行)`;
    else if (r.reason) detail = ` (${r.reason})`;
    report += `  ${icon} ${r.file}${detail}\n`;
  }

  report += SEP + "\n";
  return report;
}

// ---- 主逻辑 ----

function run(options) {
  const { scope = "working", dryRun = false, remove = false, allFiles = false, aiTool = "claude", author = "", verbose = false } = options;

  const finalAuthor = author || getGitAuthor();
  const dateStr = getCurrentDate();
  const results = [];
  let files;

  if (allFiles) {
    const root = isGitRepo() ? getRepoRoot() : process.cwd();
    files = getAllCodeFiles(root);
  } else {
    files = getChangedFiles(scope);
  }

  if (!files.length) {
    console.log(formatReport([], 0, verbose));
    return { results: [], total: 0 };
  }

  const insertionsMap = allFiles ? null : getChangedInsertionsMap(scope);

  for (const file of files) {
    if (shouldSkip(file)) continue;
    if (!fs.existsSync(file)) continue;

    if (remove) {
      const r = removeAnnotation(file);
      r.file = file;
      results.push(r);
      continue;
    }

    let aiLines;
    if (allFiles) {
      aiLines = countLines(file);
    } else {
      aiLines = (insertionsMap && insertionsMap[file]) || 0;
    }

    if (aiLines === 0) { results.push({ file, action: "skipped", reason: "0 lines" }); continue; }

    const r = annotateFile(file, aiLines, aiTool, finalAuthor, dateStr, dryRun);
    r.file = file;
    results.push(r);
  }

  console.log(formatReport(results, files.length, verbose));
  return { results, total: files.length };
}

// ---- CLI ----

if (require.main === module) {
  const args = process.argv.slice(2);
  const opts = { scope: "working", dryRun: false, remove: false, allFiles: false, aiTool: "claude", author: "", verbose: false, json: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--scope": case "-s": opts.scope = args[++i] || "all"; break;
      case "--dry-run": case "-n": opts.dryRun = true; break;
      case "--remove": case "-r": opts.remove = true; break;
      case "--all-files": case "-a": opts.allFiles = true; break;
      case "--tool": case "-t": opts.aiTool = args[++i] || "cursor"; break;
      case "--author": opts.author = args[++i] || ""; break;
      case "-v": case "--verbose": opts.verbose = true; break;
      case "--json": opts.json = true; break;
      case "-h": case "--help":
        console.log(`
AIGC 代码统计标注工具 - 用法:

  node ai_stats.js [选项]

选项:
  --all-files, -a    扫描仓库中所有代码文件（而非仅变更文件）
  --scope, -s <s>    变更模式扫描范围: working | staged | committed | all (默认 working)
  --tool, -t <name>  AI 工具名称 (默认: claude)
  --author <name>    作者名 (默认取 git user.name)
  --dry-run, -n      仅统计，不修改文件
  --remove, -r       移除已有的 AIGC 注释
  -v, --verbose      详细输出
  --json             JSON 格式输出
  -h, --help         显示帮助

标注格式:
  AIGC:cursor|author:用户名|lines:行数|dates:YYYY-MM

示例:
  node ai_stats.js                          # 标注 git add 后的文件（默认 staged）
  node ai_stats.js --all-files              # 全量扫描并标注
  node ai_stats.js --tool copilot --author zhangsan
  node ai_stats.js --all-files --dry-run    # 仅统计不修改
  node ai_stats.js --remove                 # 移除所有 AIGC 注释
`);
        process.exit(0);
    }
  }

  const result = run(opts);

  if (opts.json) {
    console.log(JSON.stringify({
      total_files: result.total,
      results: result.results.map(r => ({ file: r.file, action: r.action, new_count: r.newCount, old_count: r.oldCount, reason: r.reason })),
    }, null, 2));
  }

  process.exit(0);
}

module.exports = { annotateFile, removeAnnotation, getCommentStyle, parseAigcComment, isAigcLine };

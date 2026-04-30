#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { annotateFile } = require("./ai_stats.js");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-stats-"));
const file = path.join(dir, "sample.js");

try {
  fs.writeFileSync(file, [
    "// AIGC:cursor|author:lisi|lines:28|dates:2025-04",
    "const existing = true;",
    "",
  ].join("\n"), "utf8");

  const result = annotateFile(file, 3, "claude", "zhichen", "2026-04", false);
  const lines = fs.readFileSync(file, "utf8").split("\n");

  assert.strictEqual(result.action, "added");
  assert.strictEqual(lines[0], "// AIGC:cursor|author:lisi|lines:28|dates:2025-04");
  assert.strictEqual(lines[1], "// AIGC:claude|author:zhichen|lines:3|dates:2026-04");
  assert.strictEqual(lines[2], "const existing = true;");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

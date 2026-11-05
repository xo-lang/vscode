// lib/xopath.js: the xo.path setting, then PATH, then a checkout's xo.
"use strict";
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const xopath = require("../lib/xopath");

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xopath-"));
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), "");
  }
  return root;
}

test("the xo.path setting comes first", () => {
  const r = tree(["bin/xo"]);
  assert.strictEqual(xopath.find("/opt/xo/bin/xo", [r], { PATH: path.join(r, "bin") }, "linux").command, "/opt/xo/bin/xo");
});

test("xo on PATH comes before a checkout's", () => {
  const r = tree(["usr/bin/xo", "co/compiler/xo/main.xo", "co/bin/xo"]);
  const got = xopath.find("", [path.join(r, "co", "pkg")], { PATH: path.join(r, "usr", "bin") }, "linux");
  assert.strictEqual(got.command, path.join(r, "usr", "bin", "xo"));
});

test("a checkout's bin/xo, from a directory below it, when xo is not on PATH", () => {
  const r = tree(["co/compiler/xo/main.xo", "co/bin/xo", "co/.tools/bin/xo"]);
  const got = xopath.find("", [path.join(r, "co", "std", "json")], { PATH: "" }, "linux");
  assert.strictEqual(got.command, path.join(r, "co", "bin", "xo"));
});

test(".tools/bin/xo outside a checkout", () => {
  const r = tree(["proj/.tools/bin/xo"]);
  assert.strictEqual(xopath.find("", [path.join(r, "proj")], { PATH: "" }, "linux").command, path.join(r, "proj", ".tools", "bin", "xo"));
});

test("none: every place looked is named", () => {
  const r = tree([]);
  const got = xopath.find("", [r], { PATH: "" }, "linux");
  assert.strictEqual(got.command, undefined);
  assert.deepStrictEqual(got.tried[0], "xo on PATH");
  assert.match(got.tried[1], /bin\/xo of an Xo checkout/);
});

test("Windows: xo.exe on PATH", () => {
  const r = tree(["bin/xo.exe"]);
  assert.strictEqual(xopath.onPath("xo", { PATH: path.join(r, "bin") }, "win32"), path.join(r, "bin", "xo.exe"));
});

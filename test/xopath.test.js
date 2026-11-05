// lib/xopath.js: the xo.path setting, then PATH, then a checkout's xo.
"use strict";
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const xopath = require("../lib/xopath");

// the host's platform and binary name: the PATH separator and the paths
// are the host's (a Windows path's drive has a colon)
const PLAT = process.platform;
const XO = PLAT === "win32" ? "xo.exe" : "xo";

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xopath-"));
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), "");
  }
  return root;
}

test("the xo.path setting comes first", () => {
  const r = tree([`bin/${XO}`]);
  assert.strictEqual(xopath.find("/opt/xo/bin/xo", [r], { PATH: path.join(r, "bin") }, PLAT).command, "/opt/xo/bin/xo");
});

test("xo on PATH comes before a checkout's", () => {
  const r = tree([`usr/bin/${XO}`, "co/compiler/xo/main.xo", `co/bin/${XO}`]);
  const got = xopath.find("", [path.join(r, "co", "pkg")], { PATH: path.join(r, "usr", "bin") }, PLAT);
  assert.strictEqual(got.command, path.join(r, "usr", "bin", XO));
});

test("a checkout's bin/xo, from a directory below it, when xo is not on PATH", () => {
  const r = tree(["co/compiler/xo/main.xo", `co/bin/${XO}`, `co/.tools/bin/${XO}`]);
  const got = xopath.find("", [path.join(r, "co", "std", "json")], { PATH: "" }, PLAT);
  assert.strictEqual(got.command, path.join(r, "co", "bin", XO));
});

test(".tools/bin/xo outside a checkout", () => {
  const r = tree([`proj/.tools/bin/${XO}`]);
  assert.strictEqual(xopath.find("", [path.join(r, "proj")], { PATH: "" }, PLAT).command, path.join(r, "proj", ".tools", "bin", XO));
});

test("none: every place looked is named", () => {
  const r = tree([]);
  const got = xopath.find("", [r], { PATH: "" }, PLAT);
  assert.strictEqual(got.command, undefined);
  assert.deepStrictEqual(got.tried[0], "xo on PATH");
  assert.match(got.tried[1], /bin\/xo of an Xo checkout/);
});

test("Windows: xo.exe on PATH", () => {
  const r = tree(["bin/xo.exe"]);
  assert.strictEqual(xopath.onPath("xo", { PATH: path.join(r, "bin") }, "win32"), path.join(r, "bin", "xo.exe"));
});

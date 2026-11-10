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

test("find says where the binary came from", () => {
  const r = tree(["co/compiler/xo/main.xo", `co/bin/${XO}`, `p/${XO}`]);
  assert.strictEqual(xopath.find("/opt/xo", [], {}, PLAT).source, "setting");
  assert.strictEqual(xopath.find("", [], { PATH: path.join(r, "p") }, PLAT).source, "path");
  assert.strictEqual(xopath.find("", [path.join(r, "co")], { PATH: "" }, PLAT).source, "fallback");
  assert.strictEqual(xopath.find("", [path.join(r, "none")], { PATH: "" }, PLAT).source, undefined);
});

test("parseVersion reads xo version's first line", () => {
  assert.deepStrictEqual(xopath.parseVersion("xo 0.45.0 darwin/arm64"), [0, 45, 0]);
  assert.deepStrictEqual(xopath.parseVersion("xo 0.46.0-dev linux/amd64"), [0, 46, 0]);
  assert.deepStrictEqual(xopath.parseVersion("0.44"), [0, 44, 0]);
  assert.strictEqual(xopath.parseVersion("version unknown"), null);
  assert.ok(xopath.older([0, 35, 0], [0, 44, 0]));
  assert.ok(!xopath.older([0, 44, 0], [0, 44, 0]));
  assert.ok(!xopath.older([1, 0, 0], [0, 99, 9]));
});

test("edition reads the nearest xo.mod's edition line", () => {
  const r = tree(["a/b/main.xo"]);
  fs.writeFileSync(path.join(r, "a", "xo.mod"), "module example.com/a\nedition preview\n");
  assert.deepStrictEqual(xopath.edition(path.join(r, "a", "b")), { edition: "preview", file: path.join(r, "a", "xo.mod") });
  fs.writeFileSync(path.join(r, "a", "b", "xo.mod"), "module example.com/b\n");
  assert.strictEqual(xopath.edition(path.join(r, "a", "b")), undefined);
});

test("problems: a stale checkout's xo (the owner's 0.35 case)", () => {
  const found = { command: "/w/xo/bin/xo", source: "fallback" };
  const p = xopath.problems(found, "xo 0.35.0 darwin/arm64", { edition: "preview", file: "/w/app/xo.mod" });
  assert.deepStrictEqual(p.map((x) => x.kind), ["old", "fallback"]);
  assert.match(p[0].message, /\/w\/xo\/bin\/xo is 0\.35\.0, older than 0\.44\.0/);
  assert.match(p[1].message, /using \/w\/xo\/bin\/xo \(0\.35\.0\) found in the workspace/);
});

test("problems: an xo that rejects the project's edition", () => {
  const p = xopath.problems({ command: "/opt/xo", source: "setting" }, "xo 0.10.0", { edition: "preview", file: "/w/xo.mod" });
  assert.deepStrictEqual(p.map((x) => x.kind), ["edition", "old"]);
  assert.match(p[0].message, /rejects `edition preview` in \/w\/xo\.mod: that edition needs xo 0\.11\.0/);
});

test("problems: a current xo on PATH has none", () => {
  assert.deepStrictEqual(xopath.problems({ command: "/usr/local/bin/xo", source: "path" }, "xo 0.45.0 darwin/arm64", { edition: "preview", file: "/w/xo.mod" }), []);
  assert.deepStrictEqual(xopath.problems({ command: "/usr/local/bin/xo", source: "path" }, "version unknown", undefined), []);
  assert.deepStrictEqual(xopath.problems({ command: undefined, tried: [] }, "", undefined), []);
});

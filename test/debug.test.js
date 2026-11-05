// lib/debug.js and the manifest's "xo" debugger.
"use strict";
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const debug = require("../lib/debug");

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

test("the manifest contributes the xo debugger, launch and attach", () => {
  const d = pkg.contributes.debuggers.find((x) => x.type === "xo");
  assert.ok(d, "no xo debugger");
  assert.deepStrictEqual(d.languages, ["xo"]);
  assert.deepStrictEqual(d.configurationAttributes.launch.required, ["program"]);
  assert.ok(d.configurationAttributes.attach.properties.processId);
  assert.ok(pkg.contributes.breakpoints.some((b) => b.language === "xo"));
  assert.ok(pkg.activationEvents.includes("onDebugResolve:xo"));
});

test("F5 on a .xo file debugs its package", () => {
  assert.deepStrictEqual(debug.defaultConfig("/w/app/main.xo"), {
    type: "xo",
    request: "launch",
    name: "Xo: debug this package",
    program: "/w/app",
  });
  assert.strictEqual(debug.defaultConfig("/w/README.md"), undefined);
  assert.strictEqual(debug.defaultConfig(undefined), undefined);
});

test("a launch of Xo source is built first; an executable is not", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xodebug-"));
  const app = path.join(dir, "app");
  fs.mkdirSync(app);
  fs.writeFileSync(path.join(app, "main.xo"), "fn main() {}\n");
  fs.writeFileSync(path.join(dir, "prog"), "");
  const out = path.join(dir, "out");
  assert.deepStrictEqual(debug.buildStep({ request: "launch", program: app }, out, "linux"), {
    dir: app,
    out: path.join(out, "app"),
    args: ["build", "-o", path.join(out, "app"), app],
  });
  assert.strictEqual(debug.buildStep({ request: "launch", program: path.join(app, "main.xo") }, out, "win32").out, path.join(out, "app.exe"));
  assert.strictEqual(debug.buildStep({ request: "launch", program: path.join(dir, "prog") }, out, "linux"), undefined);
  assert.strictEqual(debug.buildStep({ request: "attach", program: app, processId: 7 }, out, "linux"), undefined);
});

test("check names what a configuration lacks", () => {
  assert.strictEqual(debug.check({ request: "launch", program: "p" }), "");
  assert.match(debug.check({ request: "launch" }), /needs program/);
  assert.match(debug.check({ request: "attach", program: "p" }), /needs processId/);
  assert.strictEqual(debug.check({ request: "attach", program: "p", processId: "42" }), "");
  assert.match(debug.check({ request: "restart" }), /launch or attach/);
});

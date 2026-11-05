// The adapter end to end: `xo debug --dap` builds nothing itself, so the
// test builds a program with `xo build`, then launches it through the
// protocol VS Code speaks, stops at a breakpoint, reads a variable, and
// runs it to its end. It needs an xo with `debug --dap` (Xo 0.40 or a
// checkout's bin/xo): XO_TEST_XO=/path/to/xo npm test; skipped without.
"use strict";
const assert = require("node:assert");
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const debug = require("../lib/debug");

const xo = process.env.XO_TEST_XO;

const { MAIN } = require("./vscode/program");

// session speaks DAP to an adapter process: send returns the response to
// a request, next the next event of a kind.
function session(proc) {
  let buf = Buffer.alloc(0);
  let seq = 1;
  const waiting = [];
  const queue = [];
  proc.stdout.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      const h = buf.indexOf("\r\n\r\n");
      if (h < 0) return;
      const n = Number(/Content-Length: (\d+)/i.exec(buf.slice(0, h).toString())[1]);
      if (buf.length < h + 4 + n) return;
      const m = JSON.parse(buf.slice(h + 4, h + 4 + n).toString());
      buf = buf.slice(h + 4 + n);
      queue.push(m);
      for (let i = 0; i < waiting.length; i++) {
        const w = waiting[i];
        const k = queue.findIndex(w.match);
        if (k >= 0) {
          waiting.splice(i--, 1);
          w.resolve(queue.splice(k, 1)[0]);
        }
      }
    }
  });
  function wait(match) {
    const k = queue.findIndex(match);
    if (k >= 0) return Promise.resolve(queue.splice(k, 1)[0]);
    return new Promise((resolve) => waiting.push({ match, resolve }));
  }
  return {
    send(command, args) {
      const s = seq++;
      const body = JSON.stringify({ seq: s, type: "request", command, arguments: args || {} });
      proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
      return wait((m) => m.type === "response" && m.request_seq === s);
    },
    next(event) {
      return wait((m) => m.type === "event" && m.event === event);
    },
  };
}

test("launch, a breakpoint, a variable, the end", { skip: !xo && "set XO_TEST_XO to an xo with debug --dap", timeout: 120000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xodap-"));
  const app = path.join(dir, "app");
  fs.mkdirSync(app);
  fs.writeFileSync(path.join(app, "main.xo"), MAIN);
  const step = debug.buildStep({ request: "launch", program: app }, path.join(dir, "out"));
  cp.execFileSync(xo, step.args, { cwd: dir, env: { ...process.env, PWD: dir } });

  const proc = cp.spawn(xo, ["debug", "--dap"], { cwd: dir, env: { ...process.env, PWD: dir } });
  const s = session(proc);
  try {
    assert.ok((await s.send("initialize", { adapterID: "xo", linesStartAt1: true, columnsStartAt1: true })).success);
    const launched = s.send("launch", { program: step.out, args: [], cwd: dir });
    await s.next("initialized");
    const bp = await s.send("setBreakpoints", { source: { path: path.join(app, "main.xo") }, breakpoints: [{ line: 3 }] });
    assert.ok(bp.body.breakpoints[0].verified, JSON.stringify(bp.body));
    await s.send("configurationDone");
    assert.ok((await launched).success);
    const stopped = await s.next("stopped");
    assert.strictEqual(stopped.body.reason, "breakpoint");
    const st = await s.send("stackTrace", { threadId: stopped.body.threadId });
    const top = st.body.stackFrames[0];
    assert.strictEqual(top.line, 3);
    const scopes = await s.send("scopes", { frameId: top.id });
    const vars = await s.send("variables", { variablesReference: scopes.body.scopes[0].variablesReference });
    const v = Object.fromEntries(vars.body.variables.map((x) => [x.name, x.value]));
    assert.strictEqual(v.s, "42", JSON.stringify(vars.body.variables));
    await s.send("continue", { threadId: stopped.body.threadId });
    const exited = await s.next("exited");
    assert.strictEqual(exited.body.exitCode, 0);
    await s.send("disconnect", {});
  } finally {
    proc.kill();
  }
});

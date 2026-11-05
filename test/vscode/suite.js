// Runs inside VS Code (run.js): the installed xo-lang.xo .vsix colors and
// serves main.xo through xo lsp, and debugs it through xo debug --dap to a
// breakpoint.
"use strict";
const assert = require("node:assert");
const path = require("path");
const vscode = require("vscode");
const { HOVER, BREAK_LINE, OUTPUT } = require("./program");

function until(what, ms, f) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = async () => {
      try {
        const v = await f();
        if (v) return resolve(v);
      } catch {}
      if (Date.now() - t0 > ms) return reject(new Error(`timed out waiting for ${what}`));
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function run() {
  const ext = vscode.extensions.getExtension("xo-lang.xo");
  assert.ok(ext, "xo-lang.xo is not installed");
  const dir = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const uri = vscode.Uri.file(path.join(dir, "app", "main.xo"));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  assert.strictEqual(doc.languageId, "xo");
  await ext.activate();
  console.log(`ok: language xo, extension ${ext.packageJSON.version} active`);

  // xo lsp: hover over add in main's call
  const hover = await until("a hover from xo lsp", 60000, async () => {
    const hs = await vscode.commands.executeCommand("vscode.executeHoverProvider", uri, new vscode.Position(HOVER.line, HOVER.character));
    const text = (hs || []).flatMap((h) => h.contents.map((c) => c.value || String(c))).join("\n");
    return text.includes("add") ? text : undefined;
  });
  console.log(`ok: hover: ${hover.split("\n").find((l) => l.includes("add"))}`);
  const toks = await vscode.commands.executeCommand("vscode.provideDocumentSemanticTokens", uri);
  assert.ok(toks && toks.data.length > 0, "no semantic tokens");
  console.log(`ok: semantic tokens: ${toks.data.length / 5}`);

  // the debugger: a breakpoint in add's loop, a variable, the end
  const events = [];
  vscode.debug.registerDebugAdapterTrackerFactory("xo", {
    createDebugAdapterTracker: () => ({ onDidSendMessage: (m) => m.type === "event" && events.push(m) }),
  });
  vscode.debug.addBreakpoints([new vscode.SourceBreakpoint(new vscode.Location(uri, new vscode.Position(BREAK_LINE - 1, 0)))]);
  const ended = new Promise((resolve) => vscode.debug.onDidTerminateDebugSession(resolve));
  const ok = await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
    type: "xo",
    request: "launch",
    name: "Xo: debug the package",
    program: path.join(dir, "app"),
    cwd: dir,
  });
  assert.ok(ok, "startDebugging failed");
  const stopped = await until("a stop at the breakpoint", 120000, () => events.find((e) => e.event === "stopped"));
  const s = vscode.debug.activeDebugSession;
  const st = await s.customRequest("stackTrace", { threadId: stopped.body.threadId });
  const top = st.stackFrames[0];
  assert.strictEqual(top.line, BREAK_LINE, JSON.stringify(top));
  const scopes = await s.customRequest("scopes", { frameId: top.id });
  const vars = await s.customRequest("variables", { variablesReference: scopes.scopes[0].variablesReference });
  const v = Object.fromEntries(vars.variables.map((x) => [x.name, x.value]));
  assert.strictEqual(v.s, "0", JSON.stringify(vars.variables));
  console.log(`ok: stopped (${stopped.body.reason}) at ${top.name} line ${top.line}, s = ${v.s}`);
  vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  await s.customRequest("continue", { threadId: stopped.body.threadId });
  await ended;
  const exited = events.find((e) => e.event === "exited");
  assert.ok(exited && exited.body.exitCode === 0, JSON.stringify(exited));
  const out = events.filter((e) => e.event === "output").map((e) => e.body.output).join("");
  assert.ok(out.includes(OUTPUT), JSON.stringify(out));
  console.log(`ok: ran to its end, output ${OUTPUT}, exit 0`);
}

module.exports = { run };

// Starts `xo lsp` for .xo files and runs `xo debug --dap` for the "xo"
// debug type. It says which xo it chose in the Xo output channel, and
// warns when none is found, when the one found is too old for the
// extension or the project's edition, or when it came from the workspace. The xo binary is lib/xopath.js's: the xo.path setting, then
// xo on PATH, then bin/xo of an Xo checkout (what `go run ./scripts/xobuild`
// builds) or .tools/bin/xo in a workspace folder, the active file's
// directory, or a directory above them.
const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const { LanguageClient, RevealOutputChannelOn } = require("vscode-languageclient/node");
const xopath = require("./lib/xopath");
const debug = require("./lib/debug");

let client;
// output is the one "Xo" output channel; each LanguageClient would
// otherwise open its own, one more per restart.
let output;

// xoPath returns the binary and every place it looked.
function xoPath() {
  const configured = vscode.workspace.getConfiguration("xo").get("path");
  const starts = (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
  const doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
  if (doc && doc.uri.scheme === "file") {
    starts.push(path.dirname(doc.uri.fsPath));
  }
  return xopath.find(configured, starts);
}

// workDir is the first workspace folder, else the home directory.
function workDir() {
  const folders = vscode.workspace.workspaceFolders || [];
  return folders.length > 0 ? folders[0].uri.fsPath : require("os").homedir();
}

// run returns what command args printed (its standard output and error),
// or "" when it could not run.
function run(command, args) {
  try {
    const r = cp.spawnSync(command, args, { timeout: 5000 });
    return ((r.stdout || "").toString() + (r.stderr || "").toString());
  } catch {
    return "";
  }
}

// version returns the first line of `xo version`, so the output channel
// shows which compiler answers (an old one rejects `edition preview`).
function version(command) {
  try {
    return cp.execFileSync(command, ["version"], { timeout: 5000 }).toString().split("\n")[0].trim();
  } catch {
    return "version unknown";
  }
}

// INSTALL_DOCS is the getting started page's install section.
const INSTALL_DOCS = "https://xolang.dev/docs/getting-started/";
const SET_PATH = "Set xo.path…";
const INSTALL = "Install docs";

// offer acts on a notification's button: SET_PATH opens the xo.path
// setting, INSTALL the install docs.
function offer(choice) {
  if (choice === SET_PATH) {
    vscode.commands.executeCommand("workbench.action.openSettings", "xo.path");
  } else if (choice === INSTALL) {
    vscode.env.openExternal(vscode.Uri.parse(INSTALL_DOCS));
  }
}

// projectDir is where to look for the project's xo.mod: the active .xo
// file's directory, else the first workspace folder.
function projectDir() {
  const doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
  if (doc && doc.uri.scheme === "file") {
    return path.dirname(doc.uri.fsPath);
  }
  const folders = vscode.workspace.workspaceFolders || [];
  return folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

// report logs the chosen binary and tells the user what lib/xopath.js's
// problems finds: an edition the xo rejects is an error, an xo older than
// MIN_XO a warning, and a binary found in the workspace (no xo on PATH,
// xo.path unset) a note shown once per binary.
function report(context, found, versionLine) {
  output.appendLine(`xo: ${found.command} (${versionLine}), from ${found.source === "setting" ? "xo.path" : found.source === "path" ? "PATH" : "the workspace"}`);
  const dir = projectDir();
  for (const p of xopath.problems(found, versionLine, dir ? xopath.edition(dir) : undefined)) {
    output.appendLine(`xo: ${p.message}`);
    if (p.kind === "edition") {
      vscode.window.showErrorMessage(`Xo: ${p.message}. Install a newer Xo or set xo.path.`, SET_PATH, INSTALL).then(offer);
    } else if (p.kind === "old") {
      vscode.window.showWarningMessage(`Xo: ${p.message}. Install a newer Xo or set xo.path.`, SET_PATH, INSTALL).then(offer);
    } else if (p.kind === "fallback") {
      const key = "xo.fallbackNoted:" + found.command;
      if (!context.globalState.get(key)) {
        context.globalState.update(key, true);
        vscode.window.showInformationMessage(`Xo: ${p.message}. Set xo.path to choose another.`, SET_PATH).then(offer);
      }
    }
  }
}

async function start(context) {
  if (!vscode.workspace.getConfiguration("xo").get("lsp.enabled")) {
    return;
  }
  const found = xoPath();
  const { command, tried } = found;
  if (!command) {
    output.appendLine("xo: not found; looked in: " + tried.join(", "));
    vscode.window
      .showWarningMessage("Xo: xo not found. Install Xo so xo is on PATH (then restart VS Code), or set xo.path.", SET_PATH, INSTALL)
      .then(offer);
    return;
  }
  const versionLine = version(command);
  report(context, found, versionLine);
  // xo takes its working directory from $PWD, not the OS, so PWD must
  // match cwd: VS Code started from the Dock passes PWD=/, and the server
  // then cannot place std files, so definitions in std came back empty.
  const cwd = workDir();
  client = new LanguageClient(
    "xo",
    "Xo",
    { command, args: ["lsp"], options: { cwd, env: { ...process.env, PWD: cwd } } },
    {
      documentSelector: [{ scheme: "file", language: "xo" }],
      // A failed request (hover over a package whose xo.mod does not load)
      // goes to the output channel, not a popup per mouse move.
      revealOutputChannelOn: RevealOutputChannelOn.Never,
      outputChannel: output,
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher("**/{*.xo,xo.mod,xo.work}"),
      },
    }
  );
  try {
    await client.start();
    client.outputChannel.appendLine(`xo lsp: ${command} (${versionLine})`);
  } catch (err) {
    vscode.window.showWarningMessage(
      `Xo: could not start "${command} lsp" (${(err && err.message) || err}). Set xo.path to a newer xo.`
    );
  }
}

async function stop() {
  if (client) {
    const c = client;
    client = undefined;
    await c.dispose();
  }
}

// xoBuild runs `xo build` for a launch of Xo source: the output channel
// gets its output, and the promise fails with it when the build does.
function xoBuild(command, step, cwd) {
  fs.mkdirSync(path.dirname(step.out), { recursive: true });
  output.appendLine(`xo debug: ${command} ${step.args.join(" ")}`);
  return new Promise((resolve, reject) => {
    cp.execFile(command, step.args, { cwd, env: { ...process.env, PWD: cwd } }, (err, stdout, stderr) => {
      if (stdout || stderr) {
        output.append(stdout + stderr);
      }
      if (err) {
        reject(new Error((stderr || stdout || err.message).trim()));
      } else {
        resolve();
      }
    });
  });
}

// The "xo" debug type's configurations: F5 with no launch.json debugs the
// open file's package, a launch of Xo source builds it first, and an
// attach with no processId asks for one.
const configurations = (context) => ({
  async resolveDebugConfiguration(folder, config) {
    if (!config.type && !config.request && !config.name) {
      const doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
      const d = debug.defaultConfig(doc && doc.uri.scheme === "file" ? doc.uri.fsPath : undefined);
      if (!d) {
        vscode.window.showErrorMessage("Xo: open a .xo file, or add an xo launch configuration, to debug.");
        return undefined;
      }
      config = d;
    }
    if (config.request === "attach" && !config.processId) {
      const pid = await vscode.window.showInputBox({ prompt: "Xo: the process id to attach to" });
      if (!pid) {
        return undefined;
      }
      config.processId = Number(pid);
    }
    const why = debug.check(config);
    if (why) {
      vscode.window.showErrorMessage(`Xo: ${why}.`);
      return undefined;
    }
    const { command, tried } = xoPath();
    if (!command) {
      vscode.window.showErrorMessage(`Xo: no xo binary to debug with: install Xo ${debug.MIN_XO} or later, or set xo.path. Looked in: ${tried.join(", ")}`);
      return undefined;
    }
    const problem = debug.dapProblem(run(command, ["help", "debug"]), version(command));
    if (problem) {
      vscode.window.showErrorMessage(`Xo: ${problem} at ${command}. Install a newer Xo, or set xo.path.`);
      return undefined;
    }
    const step = debug.buildStep(config, path.join(context.globalStorageUri.fsPath, "debug"));
    if (step) {
      try {
        await xoBuild(command, step, config.cwd || (folder ? folder.uri.fsPath : workDir()));
      } catch (err) {
        output.show(true);
        vscode.window.showErrorMessage(`Xo: xo build failed: ${err.message.split("\n")[0]}`);
        return undefined;
      }
      config.program = step.out;
    }
    return config;
  },
});

// The adapter is `xo debug --dap` on standard input and output.
const adapters = {
  createDebugAdapterDescriptor(session) {
    const { command, tried } = xoPath();
    if (!command) {
      throw new Error("no xo binary for xo debug --dap; looked in: " + tried.join(", "));
    }
    const cwd = session.configuration.cwd || workDir();
    output.appendLine(`xo debug: ${command} debug --dap (${version(command)})`);
    return new vscode.DebugAdapterExecutable(command, ["debug", "--dap"], { cwd, env: { ...process.env, PWD: cwd } });
  },
};

function activate(context) {
  output = vscode.window.createOutputChannel("Xo");
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider("xo", configurations(context)),
    vscode.debug.registerDebugAdapterDescriptorFactory("xo", adapters),
    output,
    vscode.commands.registerCommand("xo.restartServer", async () => {
      await stop();
      await start(context);
    }),
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("xo")) {
        await stop();
        await start(context);
      }
    })
  );
  return start(context);
}

function deactivate() {
  return stop();
}

module.exports = { activate, deactivate };

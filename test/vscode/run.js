// Installs the .vsix into a VS Code of its own (a fresh user data and
// extensions directory, so a developer's own VS Code is untouched) and
// runs suite.js in it against a small Xo program:
//   XO=/path/to/xo [CODE=/path/to/code] node test/vscode/run.js xo-0.1.0.vsix
// CODE: a VS Code CLI (default: the code on PATH; else one is downloaded).
"use strict";
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } = require("@vscode/test-electron");
const { MAIN } = require("./program");

async function main() {
  const vsix = path.resolve(process.argv[2] || "");
  const xo = process.env.XO;
  if (!fs.existsSync(vsix) || !xo) {
    console.error("usage: XO=/path/to/xo node test/vscode/run.js FILE.vsix");
    process.exit(2);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "xo-vsix-"));
  const ws = path.join(tmp, "ws");
  fs.mkdirSync(path.join(ws, "app"), { recursive: true });
  fs.mkdirSync(path.join(ws, ".vscode"));
  fs.writeFileSync(path.join(ws, "app", "main.xo"), MAIN);
  fs.writeFileSync(path.join(ws, ".vscode", "settings.json"), JSON.stringify({ "xo.path": xo }));
  const ext = path.join(tmp, "extensions");
  const user = path.join(tmp, "user");
  const exe = process.env.VSCODE_EXE || (await downloadAndUnzipVSCode("stable"));
  const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(exe);
  cp.execFileSync(cli, [...cliArgs, "--extensions-dir", ext, "--user-data-dir", user, "--install-extension", vsix], { stdio: "inherit" });
  await runTests({
    vscodeExecutablePath: exe,
    extensionDevelopmentPath: path.join(__dirname, "harness"),
    extensionTestsPath: path.join(__dirname, "suite.js"),
    launchArgs: [ws, "--extensions-dir", ext, "--user-data-dir", user, "--disable-workspace-trust"],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

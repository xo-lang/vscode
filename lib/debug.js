// The "xo" debug type's configurations (no VS Code API here, so the tests
// run in Node): what F5 starts with no launch.json, and a launch whose
// program is Xo source (a .xo file or a package directory), which is built
// with `xo build` first. `xo debug --dap` (decision 0253 and 0504 of Xo)
// takes launch's program (an executable built with its debug
// information), args and cwd, and attach's processId and program.
"use strict";
const fs = require("fs");
const path = require("path");

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// defaultConfig is the launch of the package of the open .xo file, or
// undefined when no .xo file is open.
function defaultConfig(activeFile) {
  if (!activeFile || !activeFile.endsWith(".xo")) {
    return undefined;
  }
  return {
    type: "xo",
    request: "launch",
    name: "Xo: debug this package",
    program: path.dirname(activeFile),
  };
}

// buildStep returns how to build config's program when it is Xo source: {
// dir, out, args } for `xo build -o out dir`, the config then launching out;
// undefined when program is an executable. outDir is where built programs
// go (the extension's storage).
function buildStep(config, outDir, platform) {
  if (config.request !== "launch" || !config.program) {
    return undefined;
  }
  const p = config.program;
  let dir;
  if (p.endsWith(".xo")) {
    dir = path.dirname(p);
  } else if (isDir(p)) {
    dir = p;
  } else {
    return undefined;
  }
  const name = path.basename(path.resolve(dir)) || "prog";
  const out = path.join(outDir, (platform || process.platform) === "win32" ? name + ".exe" : name);
  return { dir, out, args: ["build", "-o", out, dir] };
}

// check returns why config cannot start, or "".
function check(config) {
  if (config.request === "launch") {
    return config.program ? "" : "an xo launch needs program (an executable, a .xo file, or a package directory)";
  }
  if (config.request === "attach") {
    if (!Number.isInteger(Number(config.processId)) || Number(config.processId) <= 0) {
      return "an xo attach needs processId (the process to attach to)";
    }
    return config.program ? "" : "an xo attach needs program (the process's executable, built with its debug information)";
  }
  return `xo debug configurations are launch or attach, not ${JSON.stringify(config.request)}`;
}

module.exports = { defaultConfig, buildStep, check };

// Finding the xo binary as an installed user has it: the xo.path setting,
// then xo on PATH, then (for working on Xo itself) bin/xo of an Xo checkout
// or .tools/bin/xo in a workspace folder, the active file's directory, or
// any directory above them. No VS Code API here, so the tests run in Node.
"use strict";
const fs = require("fs");
const path = require("path");

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

// exe is name with Windows' .exe added there.
function exe(name, platform) {
  return (platform || process.platform) === "win32" ? name + ".exe" : name;
}

// candidates returns the binaries dir may hold, best first. bin/xo counts
// only in an Xo checkout (it has compiler/xo/main.xo), where it is the
// current compiler and .tools/bin/xo may be an old one.
function candidates(d, platform) {
  const out = [];
  if (isFile(path.join(d, "compiler", "xo", "main.xo"))) {
    out.push(path.join(d, "bin", exe("xo", platform)));
  }
  out.push(path.join(d, ".tools", "bin", exe("xo", platform)));
  return out;
}

// upward returns the first binary of candidates in dir or the nearest
// directory above it that has one.
function upward(dir, platform) {
  for (let d = dir; d; ) {
    const c = candidates(d, platform).find(isFile);
    if (c) {
      return c;
    }
    const parent = path.dirname(d);
    if (parent === d) {
      break;
    }
    d = parent;
  }
  return undefined;
}

// onPath returns name's file in a directory of PATH.
function onPath(name, env, platform) {
  const sep = (platform || process.platform) === "win32" ? ";" : ":";
  for (const dir of ((env || process.env).PATH || "").split(sep)) {
    const c = path.join(dir, exe(name, platform));
    if (dir && isFile(c)) {
      return c;
    }
  }
  return undefined;
}

// find returns { command, tried }: the binary (undefined when there is
// none) and every place looked. configured is the xo.path setting, starts
// the directories to look upward from for a checkout's xo.
function find(configured, starts, env, platform) {
  if (configured) {
    return { command: configured, tried: [`xo.path (${configured})`] };
  }
  const tried = ["xo on PATH"];
  const p = onPath("xo", env, platform);
  if (p) {
    return { command: p, tried };
  }
  for (const s of starts) {
    tried.push(s + " (and above)/{bin/xo of an Xo checkout,.tools/bin/xo}");
    const c = upward(s, platform);
    if (c) {
      return { command: c, tried };
    }
  }
  return { command: undefined, tried };
}

module.exports = { find, onPath, upward };

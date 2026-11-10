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
// source says where command came from: "setting" (xo.path), "path" (xo
// on PATH) or "fallback" (a checkout's bin/xo or .tools/bin/xo found
// upward), so the extension can say when it picked a fallback.
function find(configured, starts, env, platform) {
  if (configured) {
    return { command: configured, source: "setting", tried: [`xo.path (${configured})`] };
  }
  const tried = ["xo on PATH"];
  const p = onPath("xo", env, platform);
  if (p) {
    return { command: p, source: "path", tried };
  }
  for (const s of starts) {
    tried.push(s + " (and above)/{bin/xo of an Xo checkout,.tools/bin/xo}");
    const c = upward(s, platform);
    if (c) {
      return { command: c, source: "fallback", tried };
    }
  }
  return { command: undefined, source: undefined, tried };
}

// MIN_XO is the oldest xo the extension's grammar and language server
// features are written against. xo.mod has no line naming an xo version,
// so this is the extension's own floor, not the project's.
const MIN_XO = "0.44.0";

// EDITION_SINCE maps an xo.mod edition to the first xo that reads it: an
// older xo stops the check at the edition line (decision 0155).
const EDITION_SINCE = { preview: "0.11.0" };

// parseVersion returns [major, minor, patch] of `xo version`'s first line
// ("xo 0.45.0 darwin/arm64", "xo 0.46.0-dev ...") or of a bare "0.44"; null
// when there is none.
function parseVersion(text) {
  const m = /(?:^|\s|v)(\d+)\.(\d+)(?:\.(\d+))?/.exec(text || "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}

// older reports whether version a is before b (both parseVersion's).
function older(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] < b[i];
    }
  }
  return false;
}

// edition returns the edition line of the xo.mod in dir or the nearest
// directory above it, with that file: { edition, file }, or undefined
// when there is no xo.mod or it has no edition line.
function edition(dir) {
  for (let d = dir; d; ) {
    const f = path.join(d, "xo.mod");
    if (isFile(f)) {
      let text = "";
      try {
        text = fs.readFileSync(f, "utf8");
      } catch {
        return undefined;
      }
      const m = /^\s*edition\s+(\S+)/m.exec(text);
      return m ? { edition: m[1], file: f } : undefined;
    }
    const parent = path.dirname(d);
    if (parent === d) {
      break;
    }
    d = parent;
  }
  return undefined;
}

// problems returns what to tell the user about the binary find chose,
// worst first: each { kind, message }. versionLine is `xo version`'s
// first line; mod is edition()'s result for the project, if any.
//   - "edition": the xo is older than the first one that reads the
//     project's edition line, so it rejects every file;
//   - "old": the xo is older than MIN_XO;
//   - "fallback": the xo came from a checkout or .tools/bin, not xo.path
//     or PATH (a stale checkout's bin/xo is easy to miss).
function problems(found, versionLine, mod) {
  const out = [];
  if (!found || !found.command) {
    return out;
  }
  const v = parseVersion(versionLine);
  const shown = v ? v.join(".") : "of an unknown version";
  if (v && mod && EDITION_SINCE[mod.edition] && older(v, parseVersion(EDITION_SINCE[mod.edition]))) {
    out.push({
      kind: "edition",
      message: `the xo at ${found.command} (${shown}) rejects \`edition ${mod.edition}\` in ${mod.file}: that edition needs xo ${EDITION_SINCE[mod.edition]} or later`,
    });
  }
  if (v && older(v, parseVersion(MIN_XO))) {
    out.push({
      kind: "old",
      message: `the xo at ${found.command} is ${shown}, older than ${MIN_XO}, which this extension needs; its errors may be wrong for current code`,
    });
  }
  if (found.source === "fallback") {
    out.push({
      kind: "fallback",
      message: `no xo on PATH and xo.path is unset, so the extension is using ${found.command} (${shown}) found in the workspace`,
    });
  }
  return out;
}

module.exports = { find, onPath, upward, parseVersion, older, edition, problems, MIN_XO, EDITION_SINCE };

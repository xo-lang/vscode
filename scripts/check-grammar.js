#!/usr/bin/env node
// check-grammar.js keeps the TextMate grammar in step with Xo's lexer: the
// grammar's keywords rule must name exactly the keywords of KEYWORDS in
// compiler/lexer/token.xo, and package.json must point at the grammar.
//
//   node scripts/check-grammar.js                 # the newest Xo release's lexer
//   node scripts/check-grammar.js --tag v0.39.0   # a given release
//   node scripts/check-grammar.js --lexer PATH    # a local token.xo (a checkout)
//
// A release's lexer is read from the public xo-lang/xo repository at the
// release's tag (GitHub's API names the newest release). Exit 0 when they
// agree, 1 when they differ, 2 when the lexer cannot be read.
"use strict";
const fs = require("fs");
const https = require("https");
const path = require("path");

const root = path.resolve(__dirname, "..");
const REPO = "xo-lang/xo";

// headers names this script, and in CI passes GITHUB_TOKEN to GitHub's API
// (whose unauthenticated limit runners share).
function headers(url) {
  const h = { "User-Agent": "xo-vscode-check-grammar" };
  if (process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com/")) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: headers(url) }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(get(res.headers.location));
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`${url}: HTTP ${res.statusCode}`));
          } else {
            resolve(body);
          }
        });
      })
      .on("error", reject);
  });
}

// lexerKeywords returns the keys of KEYWORDS in token.xo's source.
function lexerKeywords(src) {
  const i = src.indexOf("const KEYWORDS = {\n");
  if (i < 0) {
    throw new Error("no KEYWORDS table in token.xo");
  }
  const body = src.slice(i, src.indexOf("\n}\n", i));
  const out = [];
  for (const m of body.matchAll(/^ {2}"(\w+)": Kind\./gm)) {
    out.push(m[1]);
  }
  return out;
}

// grammarKeywords returns the words of the grammar's keywords rule, each
// match \b(?:a|b|c)\b or \bword\b.
function grammarKeywords(g) {
  const kw = g.repository && g.repository.keywords;
  if (!kw) {
    throw new Error("the grammar has no keywords rule");
  }
  const out = [];
  for (const p of kw.patterns) {
    let m = p.match.replace(/^\\b/, "").replace(/\\b$/, "");
    m = m.replace(/^\(\?:/, "").replace(/\)$/, "");
    for (const alt of m.split("|")) {
      if (!/^[a-z]+$/.test(alt)) {
        throw new Error(`keyword rule ${p.name} has a non word alternative ${JSON.stringify(alt)}`);
      }
      out.push(alt);
    }
  }
  return out;
}

// manifestErrors returns what is wrong with package.json's language and
// grammar entries.
function manifestErrors(g, pkg) {
  const errs = [];
  const c = pkg.contributes || {};
  const langs = c.languages || [];
  if (langs.length !== 1 || langs[0].id !== "xo" || !(langs[0].extensions || []).includes(".xo")) {
    errs.push("package.json must register language xo for .xo files");
  }
  const grammars = c.grammars || [];
  const e = grammars.find((x) => x.language === "xo");
  if (!e || e.scopeName !== g.scopeName || e.path !== "./syntaxes/xo.tmLanguage.json") {
    errs.push("package.json's grammar entry for xo does not match the grammar");
  }
  for (const x of grammars) {
    if (!fs.existsSync(path.join(root, x.path))) {
      errs.push(`package.json grammar ${x.scopeName}: no file ${x.path}`);
    }
  }
  return errs;
}

async function lexerSource(args) {
  const li = args.indexOf("--lexer");
  if (li >= 0) {
    return { src: fs.readFileSync(args[li + 1], "utf8"), from: args[li + 1] };
  }
  const ti = args.indexOf("--tag");
  let tag = ti >= 0 ? args[ti + 1] : "";
  if (!tag) {
    tag = JSON.parse(await get(`https://api.github.com/repos/${REPO}/releases/latest`)).tag_name;
  }
  const url = `https://raw.githubusercontent.com/${REPO}/${tag}/compiler/lexer/token.xo`;
  return { src: await get(url), from: `${REPO} ${tag}` };
}

async function main() {
  const g = JSON.parse(fs.readFileSync(path.join(root, "syntaxes", "xo.tmLanguage.json"), "utf8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  let lexer;
  try {
    lexer = await lexerSource(process.argv.slice(2));
  } catch (err) {
    console.error(`check-grammar: cannot read the lexer: ${err.message}`);
    return 2;
  }
  const errs = manifestErrors(g, pkg);
  const want = lexerKeywords(lexer.src).sort();
  const got = grammarKeywords(g).sort();
  const missing = want.filter((k) => !got.includes(k));
  const extra = got.filter((k) => !want.includes(k));
  if (missing.length > 0) {
    errs.push(`keywords of the lexer (${lexer.from}) not in the grammar: ${missing.join(" ")}`);
  }
  if (extra.length > 0) {
    errs.push(`keywords in the grammar not in the lexer (${lexer.from}): ${extra.join(" ")}`);
  }
  for (const e of errs) {
    console.error(`check-grammar: ${e}`);
  }
  if (errs.length === 0) {
    console.log(`check-grammar: ${got.length} keywords match ${lexer.from}`);
  }
  return errs.length === 0 ? 0 : 1;
}

if (require.main === module) {
  main().then((code) => process.exit(code));
}

module.exports = { lexerKeywords, grammarKeywords, manifestErrors };

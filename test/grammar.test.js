// The grammar's own checks that need no network: package.json points at
// it, and its keywords rule parses. `npm run check:grammar` compares the
// keywords with the newest Xo release's lexer.
"use strict";
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const check = require("../scripts/check-grammar");

const root = path.join(__dirname, "..");
const grammar = JSON.parse(fs.readFileSync(path.join(root, "syntaxes", "xo.tmLanguage.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("package.json points at the grammar", () => {
  assert.deepStrictEqual(check.manifestErrors(grammar, pkg), []);
});

test("the keywords rule lists words", () => {
  const kw = check.grammarKeywords(grammar);
  assert.ok(kw.includes("fn") && kw.includes("match"), kw.join(" "));
});

test("lexerKeywords reads token.xo's KEYWORDS table", () => {
  const src = 'const X = 1\nconst KEYWORDS = {\n  "fn": Kind.Fn,\n  "let": Kind.Let,\n}\n';
  assert.deepStrictEqual(check.lexerKeywords(src), ["fn", "let"]);
});

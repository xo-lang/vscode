#!/usr/bin/env node
// release-check.js checks a release tag against the extension and prints
// its CHANGELOG section, for the release workflow and for a dry run:
//
//   node scripts/release-check.js v0.1.1             # check, print notes
//   node scripts/release-check.js v0.1.1 notes.md    # check, write notes
//
// The tag must be v plus package.json's version, and CHANGELOG.md must
// have a section headed `## VERSION` (not marked unreleased) with text in
// it. Exit 0 when they agree, 1 when not.
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

// notes returns the text of CHANGELOG section `## version` (up to the
// next `## `), or throws why there is none.
function notes(changelog, version) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## ") && l.slice(3).trim().split(/\s/)[0] === version);
  if (start < 0) {
    throw new Error(`CHANGELOG.md has no "## ${version}" section`);
  }
  if (/unreleased/i.test(lines[start])) {
    throw new Error(`CHANGELOG.md's "${lines[start]}" is marked unreleased: drop the mark when releasing`);
  }
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) {
    end = lines.length;
  }
  const body = lines.slice(start + 1, end).join("\n").trim();
  if (!body) {
    throw new Error(`CHANGELOG.md's "## ${version}" section is empty`);
  }
  return body + "\n";
}

// check returns the notes for tag, or throws why tag cannot be released.
function check(tag, pkg, changelog) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error(`tag ${JSON.stringify(tag)} is not vMAJOR.MINOR.PATCH`);
  }
  if (tag.slice(1) !== pkg.version) {
    throw new Error(`tag ${tag} does not match package.json's version ${pkg.version}`);
  }
  return notes(changelog, pkg.version);
}

function main(args) {
  const tag = args[0] || "";
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  let text;
  try {
    text = check(tag, pkg, changelog);
  } catch (err) {
    console.error(`release-check: ${err.message}`);
    return 1;
  }
  if (args[1]) {
    fs.writeFileSync(args[1], text);
    console.log(`release-check: ${tag} matches package.json; notes in ${args[1]}`);
  } else {
    process.stdout.write(text);
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { check, notes };

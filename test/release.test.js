"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { check } = require("../scripts/release-check");

const log = "# Changelog\n\n## 0.2.0\n\n- New thing.\n- Fix.\n\n## 0.1.0\n\n- First.\n";

test("a tag matching the version gets its changelog section", () => {
  assert.strictEqual(check("v0.2.0", { version: "0.2.0" }, log), "- New thing.\n- Fix.\n");
  assert.strictEqual(check("v0.1.0", { version: "0.1.0" }, log), "- First.\n");
});

test("a tag that is not the version, or not a version, is refused", () => {
  assert.throws(() => check("v0.2.1", { version: "0.2.0" }, log), /does not match package.json's version 0.2.0/);
  assert.throws(() => check("0.2.0", { version: "0.2.0" }, log), /not vMAJOR/);
  assert.throws(() => check("v0.2.0-rc1", { version: "0.2.0-rc1" }, log), /not vMAJOR/);
});

test("a version with no section, an unreleased one or an empty one is refused", () => {
  assert.throws(() => check("v0.3.0", { version: "0.3.0" }, log), /no "## 0.3.0" section/);
  assert.throws(() => check("v0.3.0", { version: "0.3.0" }, "## 0.3.0 (unreleased)\n\n- x\n"), /marked unreleased/);
  assert.throws(() => check("v0.3.0", { version: "0.3.0" }, "## 0.3.0\n\n## 0.2.0\n- y\n"), /is empty/);
});

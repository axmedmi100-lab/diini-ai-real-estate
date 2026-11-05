import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production dependencies retain patched security versions", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");

  assert.equal(pkg.dependencies.next, "16.4.5");
  assert.equal(pkg.dependencies.openai, "^7.50.0");
  assert.match(workspace, /source-map-js: 1\.2\.2/);
  assert.match(workspace, /zod: 4\.6\.6/);
});


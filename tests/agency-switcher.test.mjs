import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("workspace selection is membership-validated and stored server-side", () => {
  const route = read("app/api/workspace/route.ts");
  const workspace = read("lib/agency-workspace.ts");

  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /\.eq\("agency_id", agencyId\)/);
  assert.match(route, /\.eq\("is_active", true\)/);
  assert.match(route, /httpOnly: true/);
  assert.match(route, /sameSite: "lax"/);
  assert.match(workspace, /ACTIVE_AGENCY_COOKIE/);
  assert.match(workspace, /membershipQuery\.eq\("agency_id", selectedAgencyId\)/);
});

test("agency switcher appears only when multiple workspaces are available", () => {
  const switcher = read("components/layout/agency-switcher.tsx");
  const shell = read("components/layout/app-shell.tsx");

  assert.match(switcher, /workspaces\.length < 2/);
  assert.match(switcher, /window\.location\.assign\("\/dashboard"\)/);
  assert.match(shell, /<AgencySwitcher/);
});


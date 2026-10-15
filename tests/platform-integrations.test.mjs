import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/202610150001_platform_integration_control.sql", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/admin/integrations/actions.ts", import.meta.url), "utf8");

test("platform integration control is super-admin gated and audited", () => {
  assert.match(migration, /is_platform_super_admin\(\)/);
  assert.match(migration, /integration_provider\.updated/);
  assert.match(migration, /agency_integration\.updated/);
  assert.match(migration, /security definer set search_path = ''/);
});

test("agency integration overrides never accept provider secrets", () => {
  assert.doesNotMatch(actions, /secret|token|api_key/i);
  assert.match(actions, /target_enabled/);
  assert.match(actions, /target_monthly_limit/);
});


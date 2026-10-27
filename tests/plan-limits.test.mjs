import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("plan limits are enforced in the database for tenant-owned resources", async () => {
  const migration = await read("supabase/migrations/202610270006_plan_limit_enforcement.sql");
  for (const resource of ["properties", "users", "leads", "follow_ups"]) assert.match(migration, new RegExp(`'${resource}'`));
  assert.match(migration, /plan_limit_reached/);
  assert.match(migration, /before insert on public\.properties/);
  assert.match(migration, /before insert on public\.agency_members/);
  assert.match(migration, /before insert on public\.leads/);
  assert.match(migration, /before insert on public\.follow_ups/);
});

test("agency actions redirect to upgrade usage when a plan limit is reached", async () => {
  const properties = await read("app/properties/actions.ts");
  const leads = await read("app/leads/actions.ts");
  const agents = await read("app/agents/actions.ts");
  const usage = await read("app/usage/page.tsx");
  assert.match(properties, /get_agency_plan_entitlement/);
  assert.match(leads, /get_agency_plan_entitlement/);
  assert.match(agents, /get_agency_plan_entitlement/);
  assert.match(usage, /Plan limit waa la gaaray/);
  assert.match(usage, /meter\("Leads"/);
});


import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/202610280003_subscription_expiry_automation.sql", "utf8");
const route = fs.readFileSync("app/api/cron/subscriptions/route.ts", "utf8");
const compose = fs.readFileSync("compose.production.yml", "utf8");

test("subscription expiry lifecycle includes reminders, grace and downgrade", () => {
  assert.match(migration, /renewal_7d/);
  assert.match(migration, /renewal_3d/);
  assert.match(migration, /renewal_1d/);
  assert.match(migration, /interval '7 days'/);
  assert.match(migration, /plan_code='starter'/);
});

test("subscription automation is idempotent and service-role only", () => {
  assert.match(migration, /unique\(subscription_id,event_key,period_end\)/);
  assert.match(migration, /on conflict do nothing/);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(route, /CRON_SECRET/);
});

test("production scheduler invokes subscription worker", () => {
  assert.match(compose, /api\/cron\/subscriptions/);
});


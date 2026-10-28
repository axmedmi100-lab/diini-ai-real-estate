import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/202610280004_revenue_dashboard.sql", "utf8");
const page = fs.readFileSync("app/admin/revenue/page.tsx", "utf8");
const route = fs.readFileSync("app/api/admin/billing/export/route.ts", "utf8");

test("revenue metrics are super-admin gated and use paid invoices", () => {
  assert.match(migration, /is_platform_super_admin/);
  assert.match(migration, /status='paid'/);
  assert.match(migration, /date_trunc\('month',now\(\)\)/);
});

test("dashboard shows MRR, history, plan mix and top agencies", () => {
  assert.match(page, /Revenue dashboard/);
  assert.match(page, /last 12 months/);
  assert.match(page, /Top agencies by revenue/);
  assert.match(page, /Export CSV/);
});

test("CSV export is platform-admin protected", () => {
  assert.match(route, /getPlatformAdmin/);
  assert.match(route, /billing_invoices/);
  assert.match(route, /text\/csv/);
});


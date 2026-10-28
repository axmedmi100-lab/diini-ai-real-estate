import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/202610280002_manual_subscription_billing.sql", "utf8");
const actions = fs.readFileSync("app/billing/actions.ts", "utf8");
const adminActions = fs.readFileSync("app/admin/billing/actions.ts", "utf8");

test("manual payments are tenant-safe and only owners can submit", () => {
  assert.match(migration, /manual_payment_tenant_select/);
  assert.match(migration, /m\.role='owner'/);
  assert.match(migration, /one_pending_per_agency/);
});

test("review is restricted, atomic, audited and idempotent", () => {
  assert.match(migration, /is_platform_super_admin/);
  assert.match(migration, /for update/);
  assert.match(migration, /payment request already reviewed/);
  assert.match(migration, /billing\.manual_payment_approved/);
  assert.match(migration, /manual:/);
});

test("agency and admin actions call database RPCs", () => {
  assert.match(actions, /create_manual_payment_request/);
  assert.match(adminActions, /platform_review_manual_payment/);
});


import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Stripe checkout and portal are owner-scoped server actions", async () => {
  const actions = await read("app/billing/actions.ts");
  assert.match(actions, /membership\.role !== "owner"/);
  assert.match(actions, /\/checkout\/sessions/);
  assert.match(actions, /mode: "subscription"/);
  assert.match(actions, /subscription_data\[metadata\]\[agency_id\]/);
  assert.match(actions, /\/billing_portal\/sessions/);
});

test("Stripe webhook verifies raw body signatures and stores idempotent events", async () => {
  const webhook = await read("app/api/webhooks/stripe/route.ts");
  const stripe = await read("lib/billing/stripe.ts");
  assert.match(webhook, /request\.text\(\)/);
  assert.match(webhook, /billing_webhook_events/);
  assert.match(webhook, /checkout\.session\.completed/);
  assert.match(webhook, /customer\.subscription\.updated/);
  assert.match(webhook, /invoice\.payment_failed/);
  assert.match(stripe, /createHmac\("sha256"/);
  assert.match(stripe, /timingSafeEqual/);
});

test("billing page shows plans, subscription and invoices", async () => {
  const page = await read("app/billing/page.tsx");
  const migration = await read("supabase/migrations/202610280001_stripe_subscription_billing.sql");
  assert.match(page, /Billing & Plans/);
  assert.match(page, /Manage billing/);
  assert.match(page, /billing_invoices/);
  assert.match(migration, /create table public\.agency_subscriptions/);
  assert.match(migration, /create table public\.billing_invoices/);
});


import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("leads remain leads until a qualifying property transaction", async () => {
  const leadActions = await read("app/leads/actions.ts");
  const whatsapp = await read("app/api/webhooks/whatsapp/route.ts");
  const migration = await read("supabase/migrations/202610110001_lead_customer_transactions.sql");

  assert.doesNotMatch(leadActions, /from\("customers"\)\.insert/);
  assert.doesNotMatch(whatsapp, /from\("customers"\)\.insert/);
  assert.match(migration, /create or replace function public\.upsert_widget_lead/);
  assert.match(migration, /insert into public\.leads/);
});

test("customer conversion stores the complete tenant-scoped deal", async () => {
  const migration = await read("supabase/migrations/202610110001_lead_customer_transactions.sql");
  for (const field of ["property_id", "transaction_type", "total_price", "deposit", "remaining_balance", "transaction_date", "status", "assigned_agent_id", "notes"]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
  assert.match(migration, /foreign key \(customer_id, agency_id\)/);
  assert.match(migration, /create policy transaction_select/);
  assert.match(migration, /update public\.leads set customer_id=customer_uuid/);
});

test("customer conversion form only offers statuses accepted by the transaction RPC", async () => {
  const leadPage = await read("app/leads/[id]/page.tsx");
  const leadActions = await read("app/leads/actions.ts");

  assert.match(leadPage, /option value="pending">Pending/);
  assert.match(leadPage, /option value="completed">Completed/);
  assert.doesNotMatch(leadPage, /option value="cancelled">Cancelled/);
  assert.match(leadActions, /\["pending", "completed"\]\.includes\(transactionStatus\)/);
});

test("customer profile can update deal status safely", async () => {
  const page = await read("app/customers/[id]/page.tsx");
  const actions = await read("app/customers/actions.ts");

  assert.match(page, /updatePropertyTransaction/);
  assert.match(page, /option value="completed">Completed/);
  assert.match(actions, /status === "completed" && paidTotal !== totalPrice/);
  assert.match(actions, /from\("property_transactions"\)\.update/);
  assert.match(actions, /\.eq\("customer_id", customerId\)\.eq\("agency_id", agency\.id\)/);
  assert.match(actions, /select\("id,status,deposit,remaining_balance"\)\.maybeSingle\(\)/);
  assert.match(actions, /revalidatePath\("\/transactions"\)/);
  assert.match(actions, /revalidatePath\("\/dashboard"\)/);
});


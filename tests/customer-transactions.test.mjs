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

test("completed buy and rent deals create tenant-scoped occupancy records", async () => {
  const migration = await read("supabase/migrations/202610270002_property_ownership_tenancy.sql");
  const propertyPage = await read("app/properties/[id]/page.tsx");
  const transactionPage = await read("app/transactions/[id]/page.tsx");
  assert.match(migration, /create table public\.property_occupancy_records/);
  assert.match(migration, /record_type in \('ownership','tenancy'\)/);
  assert.match(migration, /new\.status = 'completed'/);
  assert.match(migration, /on conflict \(transaction_id\) do update/);
  assert.match(migration, /where status = 'completed' and transaction_type in \('buy','rent'\)/);
  assert.match(migration, /public\.is_agency_member\(agency_id\)/);
  assert.match(propertyPage, /Ownership & tenancy/);
  assert.match(transactionPage, /View property record/);
});

test("active tenancies support lease terms, expiry reminders, termination and PDF", async () => {
  const migration = await read("supabase/migrations/202610270003_lease_management.sql");
  const page = await read("app/properties/[id]/page.tsx");
  const actions = await read("app/properties/lease-actions.ts");
  const route = await read("app/api/leases/[id]/pdf/route.ts");
  assert.match(migration, /monthly_rent/);
  assert.match(migration, /property_occupancy_dates_check/);
  assert.match(migration, /lease_reminder_days in \(7,14,30\)/);
  assert.match(migration, /array\[30,14,7\]/);
  assert.match(migration, /where occupancy_id is not null\s+do update/);
  assert.match(page, /Lease management/);
  assert.match(page, /Lease agreement PDF/);
  assert.match(actions, /status: "ended"/);
  assert.match(actions, /status: "available"/);
  assert.match(route, /createLeaseAgreementPdf/);
  assert.match(route, /eq\("agency_id", agency\.id\)/);
});


import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("transactions page supports finance totals, search and status filters", async () => {
  const page = await read("app/transactions/page.tsx");
  assert.match(page, /Completed revenue/);
  assert.match(page, /Collected — active deals/);
  assert.match(page, /Outstanding — pending only/);
  assert.match(page, /item\.status !== "cancelled"/);
  assert.match(page, /item\.status === "pending"/);
  assert.match(page, /Raadi customer, phone ama property/);
  assert.match(page, /All statuses/);
  assert.match(page, /item\.status === "completed"/);
  assert.match(page, /href=\{`\/transactions\/\$\{item\.id\}`\}/);
});

test("each transaction opens a dedicated editable detail page", async () => {
  const detail = await read("app/transactions/[id]/page.tsx");
  const actions = await read("app/customers/actions.ts");
  assert.match(detail, /Transaction detail/);
  assert.match(detail, /updatePropertyTransaction/);
  assert.match(detail, /Customer profile/);
  assert.match(detail, /Property details/);
  assert.match(detail, /name="return_to"/);
  assert.match(actions, /revalidatePath\(`\/transactions\/\$\{transactionId\}`\)/);
});

test("transaction detail records an auditable payment history", async () => {
  const detail = await read("app/transactions/[id]/page.tsx");
  const actions = await read("app/customers/actions.ts");
  const migration = await read("supabase/migrations/202610270001_transaction_payment_history.sql");
  assert.match(detail, /addTransactionPayment/);
  assert.match(detail, /Payment history/);
  assert.match(detail, /Payment method/);
  assert.match(actions, /from\("transaction_payments"\)\.insert/);
  assert.match(actions, /amount > remaining/);
  assert.match(migration, /create table public\.transaction_payments/);
  assert.match(migration, /sync_transaction_payment_total/);
  assert.match(migration, /OPENING-BALANCE/);
});

test("transaction invoice and payment receipt PDFs are tenant scoped", async () => {
  const detail = await read("app/transactions/[id]/page.tsx");
  const route = await read("app/api/transactions/[id]/pdf/route.ts");
  const pdf = await read("lib/pdf/transaction-document.ts");
  assert.match(detail, /Download invoice PDF/);
  assert.match(detail, /Receipt PDF/);
  assert.match(route, /eq\("agency_id", agency\.id\)/);
  assert.match(route, /Payment not found/);
  assert.match(route, /Content-Type": "application\/pdf"/);
  assert.match(pdf, /TRANSACTION INVOICE/);
  assert.match(pdf, /PAYMENT RECEIPT/);
  assert.match(pdf, /PAYMENT HISTORY/);
});

test("agency dashboard reports revenue and lead conversion", async () => {
  const dashboard = await read("app/dashboard/page.tsx");
  const shell = await read("components/layout/app-shell.tsx");
  assert.match(dashboard, /Transactions & revenue/);
  assert.match(dashboard, /Completed deals/);
  assert.match(dashboard, /Conversion rate/);
  assert.match(dashboard, /wonLeads\.count/);
  assert.match(dashboard, /Collected \(active deals\)/);
  assert.match(dashboard, /Outstanding \(pending\)/);
  assert.match(dashboard, /item\.status !== "cancelled"/);
  assert.match(shell, /Transactions/);
  assert.match(shell, /href: "\/transactions"/);
});


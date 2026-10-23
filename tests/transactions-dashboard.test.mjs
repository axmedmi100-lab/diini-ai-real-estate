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
  assert.match(page, /href=\{`\/customers\/\$\{item\.customer_id\}`\}/);
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


import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/billing/invoices/[id]/pdf/route.ts", "utf8");
const page = fs.readFileSync("app/billing/page.tsx", "utf8");

test("manual invoice PDF is tenant scoped and requires approved payment", () => {
  assert.match(route, /eq\("agency_id", agency\.id\)/);
  assert.match(route, /eq\("status", "approved"\)/);
  assert.match(route, /provider_invoice_id\.startsWith\("manual:"\)/);
});

test("billing page offers view, print and PDF download", () => {
  assert.match(page, /View \/ Print/);
  assert.match(page, /Download PDF/);
});


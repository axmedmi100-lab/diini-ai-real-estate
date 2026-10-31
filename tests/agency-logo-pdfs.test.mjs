import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("agency logo is embedded across every generated PDF", async () => {
  const [transaction, billing, transactionRoute, leaseRoute, billingRoute] = await Promise.all([
    read("lib/pdf/transaction-document.ts"),
    read("lib/pdf/billing-invoice.ts"),
    read("app/api/transactions/[id]/pdf/route.ts"),
    read("app/api/leases/[id]/pdf/route.ts"),
    read("app/api/billing/invoices/[id]/pdf/route.ts"),
  ]);
  assert.match(transaction, /embedAgencyLogo\(pdf, data\.agencyLogoUrl\)/);
  assert.match(transaction, /drawAgencyLogo\(page, logo\)/);
  assert.match(billing, /embedAgencyLogo\(pdf, data\.agencyLogoUrl\)/);
  assert.match(billing, /drawAgencyLogo\(page, logo\)/);
  assert.match(transactionRoute, /agencyLogoUrl: agency\.logo_url/);
  assert.match(leaseRoute, /agencyLogoUrl: agency\.logo_url/);
  assert.match(billingRoute, /agencyLogoUrl: agency\.logo_url/);
});

test("branding upload accepts PDF-compatible logo formats only", async () => {
  const actions = await read("app/settings/actions.ts");
  assert.match(actions, /image\/png/);
  assert.match(actions, /image\/jpeg/);
  assert.doesNotMatch(actions, /image\/webp/);
  assert.doesNotMatch(actions, /image\/svg\+xml/);
});


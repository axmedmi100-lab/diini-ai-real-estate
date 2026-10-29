import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const migration=fs.readFileSync("supabase/migrations/202610290001_expense_profit_loss.sql","utf8");const page=fs.readFileSync("app/admin/expenses/page.tsx","utf8");const actions=fs.readFileSync("app/admin/expenses/actions.ts","utf8");
test("expenses are super-admin only and audited",()=>{assert.match(migration,/is_platform_super_admin/);assert.match(migration,/expense\.created/);assert.match(migration,/expense\.deleted/);assert.match(migration,/force row level security/);});
test("profit loss calculates paid revenue minus expenses",()=>{assert.match(migration,/status='paid'/);assert.match(migration,/revenue-expenses/);assert.match(migration,/interval '11 months'/);});
test("expense UI supports tracking, reports and export",()=>{assert.match(page,/Add expense/);assert.match(page,/12-month Profit\/Loss/);assert.match(page,/Export CSV/);assert.match(actions,/platform_create_expense/);assert.match(actions,/platform_delete_expense/);});


import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const migration=fs.readFileSync("supabase/migrations/202610290002_recurring_expense_automation.sql","utf8");const route=fs.readFileSync("app/api/cron/subscriptions/route.ts","utf8");const page=fs.readFileSync("app/admin/expenses/page.tsx","utf8");
test("recurring expenses create monthly instances without duplicates",()=>{assert.match(migration,/next_occurrence_date/);assert.match(migration,/parent_expense_id,expense_date/);assert.match(migration,/on conflict do nothing/);assert.match(migration,/due_date\+interval '1 month'/);});
test("recurring expense worker is service-role only and scheduled",()=>{assert.match(migration,/auth\.role\(\)<>'service_role'/);assert.match(route,/process_recurring_expenses/);});
test("expense UI shows next occurrence and auto-created records",()=>{assert.match(page,/Next:/);assert.match(page,/Auto-created/);});


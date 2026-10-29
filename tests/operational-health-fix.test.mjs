import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const migration=fs.readFileSync("supabase/migrations/202610290004_fix_operational_health.sql","utf8");const page=fs.readFileSync("app/admin/system/page.tsx","utf8");
test("operational health serializes explicit worker fields",()=>{assert.match(migration,/'worker_name',latest\.worker_name/);assert.match(migration,/'age_seconds'/);assert.doesNotMatch(migration,/to_jsonb\(latest\)/);});
test("system dashboard exposes safe database RPC diagnostics",()=>{assert.match(page,/error\.message/);});


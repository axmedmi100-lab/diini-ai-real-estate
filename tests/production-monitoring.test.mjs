import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const migration=fs.readFileSync("supabase/migrations/202610290003_production_monitoring.sql","utf8");const health=fs.readFileSync("app/api/health/route.ts","utf8");const finance=fs.readFileSync("app/api/cron/subscriptions/route.ts","utf8");const followups=fs.readFileSync("app/api/cron/follow-ups/route.ts","utf8");
test("worker monitoring is service-role written and admin read-only",()=>{assert.match(migration,/auth\.role\(\)<>'service_role'/);assert.match(migration,/platform_worker_runs_admin_select/);assert.match(migration,/90 days/);});
test("workers record both successful and failed runs",()=>{assert.match(finance,/target_status: "failed"/);assert.match(finance,/target_status: "success"/);assert.match(followups,/target_status: "failed"/);assert.match(followups,/target_status: "success"/);});
test("health endpoint probes the database without exposing secrets",()=>{assert.match(health,/database: "healthy"/);assert.match(health,/status: 503/);assert.doesNotMatch(health,/SERVICE_ROLE|process\.env/);});


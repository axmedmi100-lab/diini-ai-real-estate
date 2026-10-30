import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const migration=fs.readFileSync("supabase/migrations/202610300004_launch_readiness.sql","utf8");const page=fs.readFileSync("app/admin/readiness/page.tsx","utf8");const shell=fs.readFileSync("components/admin/admin-shell.tsx","utf8");
test("launch readiness is restricted to Super Admin",()=>{assert.match(migration,/is_platform_super_admin\(\)/);assert.match(migration,/revoke all on function/);assert.match(page,/getPlatformAdmin/);});
test("readiness covers security, automation, recovery, alerts, integrations, billing and workflow",()=>{for(const key of ["tenant_rls","follow_up_worker","finance_worker","backup","admin_push","critical_alerts","integrations","openai","billing","properties","leads","viewings","transactions","payments"])assert.match(migration,new RegExp("'"+key+"'"));});
test("dashboard displays score, statuses and manual QA handoff",()=>{assert.match(page,/Readiness score/);assert.match(page,/passed/);assert.match(page,/warning/);assert.match(page,/failed/);assert.match(page,/Manual end-to-end QA/);assert.match(shell,/Launch readiness/);});


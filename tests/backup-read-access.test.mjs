import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const migration=fs.readFileSync("supabase/migrations/202610290006_backup_service_role_read_access.sql","utf8");const route=fs.readFileSync("app/api/cron/backups/route.ts","utf8");
test("backup tables receive explicit service-role read-only access",()=>{assert.match(migration,/grant select on table/);assert.match(migration,/public\.agencies/);assert.match(migration,/public\.platform_integration_secrets/);assert.doesNotMatch(migration,/grant (all|insert|update|delete).*agencies/i);});
test("backup endpoint still requires cron authorization",()=>{assert.match(route,/Authorization|authorization/);assert.match(route,/CRON_SECRET/);});


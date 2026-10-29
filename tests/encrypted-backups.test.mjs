import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const route=fs.readFileSync("app/api/cron/backups/route.ts","utf8");const compose=fs.readFileSync("compose.production.yml","utf8");const migration=fs.readFileSync("supabase/migrations/202610290005_encrypted_backup_tracking.sql","utf8");
test("backups require cron auth and authenticated encryption",()=>{assert.match(route,/CRON_SECRET/);assert.match(route,/aes-256-gcm/);assert.match(route,/BACKUP_ENCRYPTION_KEY/);assert.match(route,/DIINIBK1/);});
test("daily scheduler persists and retains encrypted backups",()=>{assert.match(compose,/\.\/backups:\/backups/);assert.match(compose,/mtime \+14 -delete/);assert.match(compose,/api\/cron\/backups/);});
test("backup status is admin-only and distinguishes stored files",()=>{assert.match(migration,/platform_backup_runs_admin_select/);assert.match(migration,/status in \('generated','stored','failed'\)/);});


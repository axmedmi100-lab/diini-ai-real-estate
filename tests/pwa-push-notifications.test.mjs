import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const sw=fs.readFileSync("public/sw.js","utf8");const manager=fs.readFileSync("components/pwa/pwa-manager.tsx","utf8");const migration=fs.readFileSync("supabase/migrations/202610300001_pwa_push_notifications.sql","utf8");const worker=fs.readFileSync("app/api/cron/push/route.ts","utf8");const compose=fs.readFileSync("compose.production.yml","utf8");
test("service worker displays and opens push notifications",()=>{assert.match(sw,/addEventListener\("push"/);assert.match(sw,/showNotification/);assert.match(sw,/notificationclick/);});
test("PWA manager subscribes only after a user permission gesture",()=>{assert.match(manager,/Notification\.requestPermission\(\)/);assert.match(manager,/pushManager\.subscribe/);assert.match(manager,/api\/push\/subscription/);});
test("push subscriptions are tenant and user isolated",()=>{assert.match(migration,/user_id=auth\.uid\(\)/);assert.match(migration,/is_agency_member\(agency_id\)/);assert.match(migration,/force row level security/);});
test("existing notifications are backfilled to prevent an install-time notification flood",()=>{assert.match(migration,/update public\.notifications set push_processed_at=now\(\)/);});
test("push worker is authenticated, scheduled and removes expired endpoints",()=>{assert.match(worker,/CRON_SECRET/);assert.match(worker,/status===404\|\|status===410/);assert.match(compose,/api\/cron\/push/);});


import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const manifest=fs.readFileSync("app/manifest.ts","utf8");const sw=fs.readFileSync("public/sw.js","utf8");const manager=fs.readFileSync("components/pwa/pwa-manager.tsx","utf8");
test("manifest provides installable standard and maskable icons",()=>{assert.match(manifest,/192x192/);assert.match(manifest,/512x512/);assert.match(manifest,/maskable/);assert.match(manifest,/display: "standalone"/);});
test("service worker never caches authenticated navigation responses",()=>{assert.match(sw,/request\.mode === "navigate"/);assert.match(sw,/fetch\(request\)\.catch/);assert.doesNotMatch(sw,/cache\.put\(request.*navigate/);});
test("PWA manager supports install, updates and offline state",()=>{assert.match(manager,/beforeinstallprompt/);assert.match(manager,/serviceWorker\.register/);assert.match(manager,/Update cusub/);assert.match(manager,/Internet-ka waa go'an/);});


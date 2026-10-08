import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("production security headers are configured", async () => {
  const source = await read("next.config.mjs");
  for (const header of ["X-Content-Type-Options", "Strict-Transport-Security", "Permissions-Policy", "Referrer-Policy"]) assert.match(source, new RegExp(header));
  assert.match(source, /poweredByHeader:\s*false/);
});

test("public APIs enforce persistent rate limits and payload caps", async () => {
  const widget = await read("app/api/widget/chat/route.ts");
  const webhook = await read("app/api/webhooks/whatsapp/route.ts");
  assert.match(widget, /consume_api_rate_limit/);
  assert.match(widget, /MAX_JSON_BYTES/);
  assert.match(webhook, /verifyMetaSignature/);
  assert.match(webhook, /MAX_WEBHOOK_BYTES/);
  assert.match(webhook, /consume_api_rate_limit/);
});

test("human takeover still blocks automated replies", async () => {
  const widget = await read("app/api/widget/chat/route.ts");
  const webhook = await read("app/api/webhooks/whatsapp/route.ts");
  assert.match(widget, /conversationStatus === "human_active"/);
  assert.match(webhook, /conversation\.status === "human_active"/);
});

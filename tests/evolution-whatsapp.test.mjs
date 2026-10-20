import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Evolution webhook rejects unauthenticated and unsafe events", async () => {
  const webhook = await read("app/api/webhooks/evolution/route.ts");
  assert.match(webhook, /secureTokenMatch/);
  assert.match(webhook, /EVOLUTION_WEBHOOK_TOKEN/);
  assert.match(webhook, /MAX_WEBHOOK_BYTES/);
  assert.match(webhook, /key\?\.fromMe/);
  assert.match(webhook, /@g\.us/);
  assert.match(webhook, /consume_api_rate_limit/);
});

test("Evolution outbound messages use a server-only API key", async () => {
  const provider = await read("lib/whatsapp/meta.ts");
  assert.match(provider, /process\.env\.EVOLUTION_API_KEY/);
  assert.match(provider, /\/message\/sendText\//);
  assert.match(provider, /headers: \{ apikey: apiKey/);
});


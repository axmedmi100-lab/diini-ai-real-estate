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
  assert.match(provider, /\/message\/sendMedia\//);
  assert.match(provider, /headers: \{ apikey: apiKey/);
});

test("Evolution property matches send details and image media without accidental handoff", async () => {
  const webhook = await read("app/api/webhooks/evolution/route.ts");
  assert.match(webhook, /asksToSeeProperty/);
  assert.match(webhook, /!showRequest && requirement\.human_handoff/);
  assert.match(webhook, /sendWhatsAppImage/);
  assert.match(webhook, /propertyImages\(selectedProperty\)/);
  assert.match(webhook, /evolution\.property_search_failed/);
  assert.match(webhook, /canonicalDistrict/);
  assert.match(webhook, /await search\(null\)/);
});

test("Evolution viewing requests create a real booking instead of a generic reply", async () => {
  const webhook = await read("app/api/webhooks/evolution/route.ts");
  assert.match(webhook, /asksForViewing/);
  assert.match(webhook, /parseSomaliViewingTime/);
  assert.match(webhook, /request_whatsapp_viewing/);
  assert.match(webhook, /evolution\.viewing_failed/);
  assert.match(webhook, /viewingId/);
  assert.match(webhook, /recentPropertyMessages/);
  assert.match(webhook, /recentPropertyId/);
  assert.match(webhook, /awaitingViewingTime/);
  assert.match(webhook, /parsedViewingTime && awaitingViewingTime/);
  assert.match(webhook, /ball\?an/);
  assert.match(webhook, /viewing time conflict/);
  assert.match(webhook, /viewingConflict/);
  assert.match(webhook, /occupiedTimes/);
  assert.match(webhook, /Math\.abs\(taken - candidate\)/);
});

test("Evolution confirms an existing upcoming viewing without creating another booking or handoff", async () => {
  const webhook = await read("app/api/webhooks/evolution/route.ts");
  assert.match(webhook, /asksForViewingStatus/);
  assert.match(webhook, /evolution\.viewing_status_failed/);
  assert.match(webhook, /Weli wuxuu sugayaa xaqiijinta agency-ga/);
  assert.match(webhook, /viewingStatus/);
  assert.ok(webhook.indexOf("if (asksForViewingStatus(message))") < webhook.indexOf('if (conversation.status === "human_active")'));
});


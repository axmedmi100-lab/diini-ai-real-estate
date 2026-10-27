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
  const chat = await read("lib/ai/property-chat.ts");
  assert.match(webhook, /asksToSeeProperty/);
  assert.match(webhook, /explicitHumanRequest = asksForHumanAgent\(message\)/);
  assert.match(webhook, /!showRequest && !viewingRequest && explicitHumanRequest/);
  assert.match(chat, /export function asksForHumanAgent/);
  assert.match(webhook, /sendWhatsAppImage/);
  assert.match(webhook, /properties\.slice\(0, 3\)/);
  assert.match(webhook, /property_search_result/);
  assert.match(webhook, /inferQualificationReply/);
  assert.match(webhook, /inferred\.continuesSearch/);
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
  assert.match(webhook, /parsedViewingTime && \(awaitingViewingTime \|\| conflictPrompt\)/);
  assert.match(webhook, /conflictPrompt/);
  assert.match(webhook, /parseSomaliViewingTime\(`\$\{conflictPrompt\.message\} \$\{message\}`\)/);
  assert.match(webhook, /!viewingRequest && explicitHumanRequest/);
  assert.match(webhook, /ball\?an/);
  assert.match(webhook, /viewing time conflict/);
  assert.match(webhook, /viewingConflict/);
  assert.match(webhook, /occupiedTimes/);
  assert.match(webhook, /Math\.abs\(taken - candidate\)/);
  assert.match(webhook, /aroort/);
  assert.match(webhook, /monthNames/);
  assert.match(webhook, /namedDate/);
  assert.match(webhook, /Waan kuu diyaarinayaa viewing-ka/);
  assert.match(webhook, /normalizedLower === "veiwing"/);
  assert.match(webhook, /ber\{1,2\}i/);
  assert.match(webhook, /awaitingViewingTime: true/);
  assert.ok(webhook.indexOf('if (asksForViewing(message) && !parseSomaliViewingTime(message))') < webhook.indexOf("extractChatRequirements(message"));
});

test("Evolution confirms an existing upcoming viewing without creating another booking or handoff", async () => {
  const webhook = await read("app/api/webhooks/evolution/route.ts");
  assert.match(webhook, /asksForViewingStatus/);
  assert.match(webhook, /evolution\.viewing_status_failed/);
  assert.match(webhook, /Weli wuxuu sugayaa xaqiijinta agency-ga/);
  assert.match(webhook, /viewingStatus/);
  assert.ok(webhook.indexOf("if (asksForViewingStatus(message))") < webhook.indexOf('if (conversation.status === "human_active")'));
});

test("Meta WhatsApp viewing replies use property outreach context instead of human handoff", async () => {
  const webhook = await read("app/api/webhooks/whatsapp/route.ts");
  assert.match(webhook, /asksForViewing/);
  assert.match(webhook, /request_whatsapp_viewing/);
  assert.match(webhook, /property_id/);
  assert.match(webhook, /!viewingRequest && requirement\.human_handoff/);
  assert.match(webhook, /Fadlan ii sheeg taariikhda iyo saacadda viewing-ka/);
});


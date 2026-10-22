import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("confirming a viewing sends one WhatsApp confirmation on the status transition", async () => {
  const actions = await read("app/viewings/actions.ts");
  assert.match(actions, /status === "confirmed"/);
  assert.match(actions, /existingViewing\.status !== "confirmed"/);
  assert.match(actions, /sendWhatsAppText/);
  assert.match(actions, /Viewing-gaaga/);
  assert.match(actions, /record_whatsapp_usage/);
  assert.match(actions, /whatsapp_send_failed/);
  assert.match(actions, /reminder_offset_minutes/);
  assert.match(actions, /1440/);
  assert.match(actions, /120/);
  assert.match(actions, /viewing_id,reminder_offset_minutes/);
});

test("production scheduler runs the authenticated follow-up worker", async () => {
  const compose = await read("compose.production.yml");
  assert.match(compose, /diini-real-estate-scheduler/);
  assert.match(compose, /Authorization: Bearer \$\$CRON_SECRET/);
  assert.match(compose, /api\/cron\/follow-ups/);
});


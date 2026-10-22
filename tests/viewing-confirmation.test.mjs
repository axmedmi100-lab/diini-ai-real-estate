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
  assert.match(actions, /viewing_reminder_failed/);
});

test("production scheduler runs the authenticated follow-up worker", async () => {
  const compose = await read("compose.production.yml");
  assert.match(compose, /diini-real-estate-scheduler/);
  assert.match(compose, /Authorization: Bearer \$\$CRON_SECRET/);
  assert.match(compose, /api\/cron\/follow-ups/);
});

test("follow-up UI and manual scheduling use the agency timezone", async () => {
  const [page, actions] = await Promise.all([read("app/follow-ups/page.tsx"), read("app/follow-ups/actions.ts")]);
  assert.match(page, /formatAgencyDateTime\(item\.scheduled_for, agency\.timezone\)/);
  assert.match(actions, /agencyDateTimeLocalToUtc\(text\(formData, "scheduled_for"\), agency\.timezone\)/);
});

test("completed and no-show transitions send one customer outcome message", async () => {
  const actions = await read("app/viewings/actions.ts");
  assert.match(actions, /\["completed", "no_show"\]\.includes\(status\)/);
  assert.match(actions, /existingViewing\.status !== status/);
  assert.match(actions, /Ma xiisaynaysaa property-gan/);
  assert.match(actions, /Ma rabtaa inaan kuu qabanno taariikh iyo saacad kale/);
  assert.match(actions, /Viewing outcome message failed/);
});

test("dashboard viewing changes reject property and agent time conflicts", async () => {
  const actions = await read("app/viewings/actions.ts");
  assert.match(actions, /hasViewingConflict/);
  assert.match(actions, /conflict\.property/);
  assert.match(actions, /conflict\.agent/);
  assert.match(actions, /viewing kale ayaa waqtigan uga qoran/);
});


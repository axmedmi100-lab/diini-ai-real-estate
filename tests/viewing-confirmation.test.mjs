import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("confirming a viewing sends one WhatsApp confirmation on the status transition", async () => {
  const actions = await read("app/viewings/actions.ts");
  assert.match(actions, /status === "confirmed" && existingViewing\.status !== "confirmed"/);
  assert.match(actions, /sendWhatsAppText/);
  assert.match(actions, /Viewing-gaaga/);
  assert.match(actions, /record_whatsapp_usage/);
  assert.match(actions, /whatsapp_send_failed/);
});


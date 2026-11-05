import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  guardAgainstRepeatedReply,
  historyWithoutCurrentMessage,
  isViewingRequestText,
  normalizeCustomerText,
  propertySearchFailureReply,
} from "../lib/ai/conversation-safety.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Somali and English property typos normalize without changing the original input", () => {
  const cases = [
    ["Gri kirro ah ayaan rabaa", "guri kiro ah ayaan rabaa"],
    ["Gurri Hodan ku yaal", "guri hodan ku yaal"],
    ["Rental hause", "rental house"],
    ["2 bedrom appartment", "2 bedroom apartment"],
    ["Can I book a veiwing?", "can i book a viewing?"],
    ["I want to veiw the propety", "i want to view the property"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalizeCustomerText(input), expected);
    assert.notEqual(input, expected, "the caller's original string remains untouched");
  }
});

test("viewing intent understands corrected English and informal Somali-English requests", () => {
  for (const message of [
    "I want to veiw the property",
    "Can I book a veiwing tomorrow?",
    "Iqabo ballan aan guriga ku arko",
    "Gurigaas inaan view gareeyo ayaan rabaa",
  ]) assert.equal(isViewingRequestText(message), true, message);
  assert.equal(isViewingRequestText("Waxaan rabaa guri kiro ah"), false);
});

test("WhatsApp history removes only the just-persisted current customer message", () => {
  const history = [
    { sender_type: "customer", message: "Guri ayaan rabaa" },
    { sender_type: "ai", message: "Ma kiro mise iib?" },
    { sender_type: "customer", message: "Kirro" },
  ];
  assert.deepEqual(historyWithoutCurrentMessage(history, "Kiro"), history.slice(0, -1));
  assert.deepEqual(historyWithoutCurrentMessage(history, "3 qol"), history);
  assert.equal(history.length, 3, "the original chronological history is not mutated");
});

test("repetition guard clarifies unresolved questions and preserves useful or factual answers", () => {
  const recentMessages = [
    { sender_type: "customer", message: "Maxaad qaban kartaa?" },
    { sender_type: "ai", message: "Ii sheeg degmada iyo budget-ka." },
    { sender_type: "customer", message: "Kiradiisa meeqa?" },
  ];
  const clarified = guardAgainstRepeatedReply({
    reply: "Ii sheeg degmada iyo budget-ka.",
    currentMessage: "Xagee ku yaal?",
    recentMessages,
    language: "so",
    intent: "general",
  });
  assert.notEqual(clarified, "Ii sheeg degmada iyo budget-ka.");
  assert.match(clarified, /Property-gee.*goobtiisa/);

  const factual = "Ma helin property diyaar ah oo dhammaan shuruudahaas leh.";
  assert.equal(guardAgainstRepeatedReply({ reply: factual, currentMessage: "Hodan", recentMessages: [{ sender_type: "ai", message: factual }], language: "so", intent: "property_search" }), factual);

  const useful = "Agency-gu wuxuu furan yahay 8:00 subaxnimo ilaa 5:00 galabnimo.";
  assert.equal(guardAgainstRepeatedReply({ reply: useful, currentMessage: "Sabtida ma furan yahay?", recentMessages: [{ sender_type: "ai", message: useful }], language: "so", intent: "general" }), useful);
});

test("both WhatsApp handlers exclude the current message before OpenAI extraction", async () => {
  for (const path of ["app/api/webhooks/evolution/route.ts", "app/api/webhooks/whatsapp/route.ts"]) {
    const source = await read(path);
    assert.match(source, /historyWithoutCurrentMessage\(orderedHistory, message\)/);
    assert.match(source, /extractChatRequirements\(message, priorHistory,/);
  }
});

test("website and Meta property searches treat RPC failure separately from empty results", async () => {
  const [widget, meta] = await Promise.all([
    read("app/api/widget/chat/route.ts"),
    read("app/api/webhooks/whatsapp/route.ts"),
  ]);
  assert.match(widget, /widget\.property_search_failed/);
  assert.match(widget, /return bad\(.+503, id\)/s);
  assert.match(meta, /whatsapp\.property_search_failed/);
  assert.match(meta, /propertySearchFailureReply\(requirement\.language\)/);
  assert.match(meta, /searchUnavailable: true, recoverySent/);
  assert.doesNotMatch(meta, /Property search temporarily unavailable.+status: 503/s);
});

test("database search failure produces a safe bilingual recovery without claiming no matches", () => {
  const somali = propertySearchFailureReply("so");
  const english = propertySearchFailureReply("en");
  assert.match(somali, /ku-meel-gaar|la kaydiyey|mar kale isku day/);
  assert.match(english, /temporarily unavailable|was saved|try.*again/i);
  assert.doesNotMatch(`${somali} ${english}`, /ma helin property|no matching propert/i);
});

test("all customer channels apply the same lightweight repetition guard", async () => {
  const sources = await Promise.all([
    read("app/api/widget/chat/route.ts"),
    read("app/api/webhooks/evolution/route.ts"),
    read("app/api/webhooks/whatsapp/route.ts"),
  ]);
  for (const source of sources) assert.match(source, /guardAgainstRepeatedReply/);
});


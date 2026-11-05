export type ConversationMessage = { sender_type: string; message: string };

const typoRules: Array<[RegExp, string]> = [
  [/\b(?:gri|gurri)\b/giu, "guri"],
  [/\bkirro\b/giu, "kiro"],
  [/\bhause\b/giu, "house"],
  [/\bappartment\b/giu, "apartment"],
  [/\bbedrom\b/giu, "bedroom"],
  [/\brentel\b/giu, "rental"],
  [/\bpropety\b/giu, "property"],
  [/\bveiwing\b/giu, "viewing"],
  [/\bveiw\b/giu, "view"],
];

export function normalizeCustomerText(message: string) {
  let normalized = message.normalize("NFKC").replace(/\p{Cf}/gu, "");
  for (const [pattern, replacement] of typoRules) normalized = normalized.replace(pattern, replacement);
  return normalized.replace(/\s+/g, " ").trim().toLowerCase();
}

export function historyWithoutCurrentMessage(history: ConversationMessage[], currentMessage: string) {
  const last = history.at(-1);
  if (last?.sender_type === "customer" && normalizeCustomerText(last.message) === normalizeCustomerText(currentMessage)) {
    return history.slice(0, -1);
  }
  return history;
}

export function isViewingRequestText(message: string) {
  const normalized = normalizeCustomerText(message);
  return /\b(viewing|view|appointment|ball?an|booqasho|daawasho|so{1,2}\s+ark[ao]|so{1,2}\s+arki|arkaa|arko|daawado)\b/i.test(normalized);
}

function comparable(value: string) {
  return normalizeCustomerText(value).replace(/[^\p{L}\p{N}$]+/gu, " ").trim();
}

function unresolvedReply(reply: string) {
  return /(?:su'aashaas si fiican uma fahmin|i did not fully understand|ii sheeg degmada.{0,30}budget-ka|tell me the district.{0,30}budget)/i.test(reply);
}

function clarificationFor(message: string, language: "so" | "en", propertySearch: boolean) {
  const normalized = normalizeCustomerText(message);
  if (/\b(?:qiime|qiimaha|kirada|meeqa|price|cost|how much)\b/i.test(normalized)) {
    return language === "en" ? "Which property would you like the price for?" : "Property-gee ayaad rabtaa inaan qiimihiisa kuu sheego?";
  }
  if (/\b(?:xagee|halkee|goob|location|where)\b/i.test(normalized)) {
    return language === "en" ? "Which property would you like the location for?" : "Property-gee ayaad rabtaa inaan goobtiisa kuu sheego?";
  }
  if (/\b(?:view|viewing|ballan|booqasho|arko)\b/i.test(normalized)) {
    return language === "en" ? "Which property would you like to view, and what date and time suit you?" : "Property-gee ayaad rabtaa inaad aragto, taariikh iyo saacad noocee ahna kugu habboon?";
  }
  if (propertySearch) {
    return language === "en"
      ? "I understood your new search detail. What is the one remaining requirement: district, budget, bedrooms, or rent/buy?"
      : "Xogtaada cusub waan fahmay. Maxay tahay xogta keliya ee weli ka maqan: degmada, budget-ka, qolalka, ama kiro/iib?";
  }
  return language === "en" ? "Could you clarify what you would like to know?" : "Fadlan ii caddee waxa aad rabto inaan kuu sheego.";
}

export function propertySearchFailureReply(language: "so" | "en") {
  return language === "en"
    ? "Property search is temporarily unavailable. Your message was saved; please try the search again shortly."
    : "Property raadinta si ku-meel-gaar ah looma heli karo. Fariintaada waa la kaydiyey; fadlan wax yar kadib mar kale isku day.";
}

export function guardAgainstRepeatedReply(input: {
  reply: string;
  currentMessage: string;
  recentMessages: ConversationMessage[];
  language: "so" | "en";
  intent: "greeting" | "property_search" | "capability" | "general" | "human_handoff";
}) {
  const previousAI = input.recentMessages.toReversed().find((item) => item.sender_type === "ai");
  if (!previousAI || comparable(previousAI.message) !== comparable(input.reply)) return input.reply;

  const previousCustomer = input.recentMessages.toReversed().find((item) => item.sender_type === "customer");
  if (previousCustomer && comparable(previousCustomer.message) === comparable(input.currentMessage)) return input.reply;
  if (input.intent === "human_handoff" || !unresolvedReply(input.reply)) return input.reply;
  return clarificationFor(input.currentMessage, input.language, input.intent === "property_search");
}


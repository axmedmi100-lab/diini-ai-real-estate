export type ConversationMessage = { sender_type: string; message: string };

const typoRules: Array<[RegExp, string]> = [
  [/\b(?:gri|gurri)\b/giu, "guri"],
  [/\bkirro\b/giu, "kiro"],
  [/\bhause\b/giu, "house"],
  [/\bappartment\b/giu, "apartment"],
  [/\bbedrom\b/giu, "bedroom"],
  [/\brentel\b/giu, "rental"],
  [/\bpropety\b/giu, "property"],
  [/\b(?:veiwing|veiw)\b/giu, "viewing"],
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

function comparable(value: string) {
  return normalizeCustomerText(value).replace(/[^\p{L}\p{N}$]+/gu, " ").trim();
}

function factualSearchReply(reply: string) {
  return /(?:waxaan helay|ma helin property|i found \d+|couldn't find an available property)/i.test(reply);
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
  if (input.intent === "human_handoff" || factualSearchReply(input.reply)) return input.reply;

  if (input.intent === "property_search") {
    return input.language === "en"
      ? "I understood your new message. To continue the search, please tell me the one detail still missing: district, budget, bedrooms, or rent/buy."
      : "Fariintaada cusub waan fahmay. Si aan raadinta u sii wado, ii sheeg xogta keliya ee weli ka maqan: degmada, budget-ka, qolalka, ama kiro/iib.";
  }
  return input.language === "en"
    ? "I may not have answered your new question clearly. Please clarify the specific property, price, location, or viewing information you need."
    : "Waxaan u muuqdaa inaanan su'aashaada cusub si cad uga jawaabin. Fadlan ii caddee property-ga, qiimaha, goobta, ama viewing-ga aad ka war rabto.";
}


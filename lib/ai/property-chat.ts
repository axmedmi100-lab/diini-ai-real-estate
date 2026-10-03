import OpenAI from "openai";

export type ChatRequirements = {
  language: "so" | "en";
  purpose: "rent" | "sale" | null;
  district: string | null;
  budget_min: number | null;
  budget_max: number | null;
  bedrooms: number | null;
  property_type: string | null;
  furnished: boolean | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  human_handoff: boolean;
  reply: string;
};

const propertyTypes = ["apartment", "house", "villa", "office", "shop", "land", "commercial", "other"];

function numberNear(message: string, expression: RegExp) {
  const match = message.match(expression);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function fallbackExtraction(message: string): ChatRequirements {
  const lower = message.toLowerCase();
  const somaliSignals = lower.match(/\b(waxaan|rabaa|guri|kiro|iib|degmo|degmada|qol|qolal|kaygu|ahay|ii|iga|ama)\b/g)?.length ?? 0;
  const englishSignals = lower.match(/\b(the|want|rent|buy|house|apartment|bedroom|looking|need|my|is)\b/g)?.length ?? 0;
  const language = englishSignals > somaliSignals ? "en" : "so";
  const purpose = /\b(sale|buy|iib|iibsado|gadasho)\b/.test(lower) ? "sale" : /\b(rent|kiro|kireys)\b/.test(lower) ? "rent" : null;
  const district = message.match(/(?:degmada|degmo|district)\s+([\p{L}'-]+)/iu)?.[1] ?? null;
  const bedrooms = numberNear(lower, /(\d+)\s*(?:qol|bed|bedroom)/);
  const money = [...lower.matchAll(/\$?\s*(\d[\d,]*)/g)].map((match) => Number(match[1].replace(/,/g, ""))).filter((value) => value >= 50);
  const propertyType = propertyTypes.find((type) => lower.includes(type)) ?? (lower.includes("guri") ? "house" : null);
  const furnished = /unfurnished|aan\s+furnished/.test(lower) ? false : /furnished|alaabaysan/.test(lower) ? true : null;
  const phone = message.match(/\+?\d[\d\s-]{7,}/)?.[0]?.trim() ?? null;
  const email = message.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? null;
  const reply = language === "en"
    ? "Thanks. Tell me the district, budget, bedrooms, and whether you want to rent or buy so I can search this agency's available properties."
    : "Mahadsanid. Ii sheeg degmada, budget-ka, tirada qolalka, iyo inaad rabto kiro ama iib si aan uga raadiyo properties-ka agency-gan.";
  return { language, purpose, district, budget_min: money[0] ?? null, budget_max: money[1] ?? money[0] ?? null, bedrooms, property_type: propertyType, furnished, name: null, phone, email, human_handoff: /human|agent|qof|la hadal/.test(lower), reply };
}

export async function extractChatRequirements(message: string, recentMessages: Array<{ sender_type: string; message: string }>) {
  if (!process.env.OPENAI_API_KEY) return { data: fallbackExtraction(message), usedAI: false };
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-6-luna",
    reasoning: { effort: "none" },
    instructions: "You extract real-estate requirements from Somali, English, or mixed chat. Never invent facts. Preserve known facts from recent messages. The reply must be concise and in the user's language. Ask only for important missing requirements. If the user requests a person, set human_handoff true.",
    input: `Recent chat:\n${recentMessages.slice(-8).map((item) => `${item.sender_type}: ${item.message}`).join("\n")}\ncustomer: ${message}`,
    text: {
      format: {
        type: "json_schema",
        name: "property_requirements",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["language", "purpose", "district", "budget_min", "budget_max", "bedrooms", "property_type", "furnished", "name", "phone", "email", "human_handoff", "reply"],
          properties: {
            language: { type: "string", enum: ["so", "en"] },
            purpose: { anyOf: [{ type: "string", enum: ["rent", "sale"] }, { type: "null" }] },
            district: { anyOf: [{ type: "string" }, { type: "null" }] },
            budget_min: { anyOf: [{ type: "number" }, { type: "null" }] },
            budget_max: { anyOf: [{ type: "number" }, { type: "null" }] },
            bedrooms: { anyOf: [{ type: "integer" }, { type: "null" }] },
            property_type: { anyOf: [{ type: "string", enum: propertyTypes }, { type: "null" }] },
            furnished: { anyOf: [{ type: "boolean" }, { type: "null" }] },
            name: { anyOf: [{ type: "string" }, { type: "null" }] },
            phone: { anyOf: [{ type: "string" }, { type: "null" }] },
            email: { anyOf: [{ type: "string" }, { type: "null" }] },
            human_handoff: { type: "boolean" },
            reply: { type: "string" },
          },
        },
      },
    },
  });
  return { data: JSON.parse(response.output_text) as ChatRequirements, usedAI: true };
}

export function formatPropertyReply(language: "so" | "en", count: number) {
  if (language === "en") return count ? `I found ${count} available ${count === 1 ? "property" : "properties"} matching your request.` : "I couldn't find an available property matching all those requirements. Try changing the district or budget, or ask for a human agent.";
  return count ? `Waxaan helay ${count} ${count === 1 ? "property" : "properties"} oo diyaar ah kuna habboon codsigaaga.` : "Ma helin property diyaar ah oo dhammaan shuruudahaas leh. Waxaad beddeli kartaa degmada ama budget-ka, ama waxaad codsan kartaa agent.";
}

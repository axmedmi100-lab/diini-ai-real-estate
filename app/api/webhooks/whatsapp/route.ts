import { NextResponse } from "next/server";

import { extractChatRequirements, formatPropertyReply } from "@/lib/ai/property-chat";
import { contentLengthExceeds, logServerEvent, MAX_WEBHOOK_BYTES, requestId } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateAiCostUsd } from "@/lib/usage/ai-cost";
import { sendWhatsAppText, verifyMetaSignature } from "@/lib/whatsapp/meta";

type MetaMessage = { from?: string; id?: string; type?: string; text?: { body?: string } };
type MetaValue = { metadata?: { phone_number_id?: string }; contacts?: Array<{ profile?: { name?: string } }>; messages?: MetaMessage[] };
type MetaPayload = { entry?: Array<{ changes?: Array<{ field?: string; value?: MetaValue }> }> };

function normalizePhone(value: string) { return value.replace(/\D/g, ""); }

function asksForViewing(message: string) {
  return /(viewing|appointment|ball?an|booqasho|daawasho|so{1,2}\s+ark[ao]|daawado)/i.test(message.normalize("NFKC"));
}

function parseViewingTime(message: string, now = new Date()) {
  const lower = message.toLowerCase();
  const matches = [...lower.matchAll(/(\d{1,2})(?::(\d{2}))\s*(aroort(?:ii|nimo)?|subax(?:ii|nimo)?|duhurnimo|galabnimo|fiidnimo|habeenimo|am|pm)?|\b(\d{1,2})\s*(aroort(?:ii|nimo)?|subax(?:ii|nimo)?|duhurnimo|galabnimo|fiidnimo|habeenimo|am|pm)\b/gi)];
  const time = matches.at(-1);
  if (!time) return null;
  let hour = Number(time[1] ?? time[4]);
  const minute = Number(time[2] ?? 0);
  const period = (time[3] ?? time[5])?.toLowerCase();
  if (hour > 23 || minute > 59) return null;
  if (["galabnimo", "fiidnimo", "habeenimo", "pm"].includes(period ?? "") && hour < 12) hour += 12;
  if (/^(?:aroort|subax)|^am$/.test(period ?? "") && hour === 12) hour = 0;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Mogadishu", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  let year = part("year"), month = part("month"), day = part("day");
  let offset = /\b(berri|tomorrow)\b/i.test(lower) ? 1 : /\b(maanta|today)\b/i.test(lower) ? 0 : -1;
  const explicit = lower.match(/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/);
  if (explicit) { year = Number(explicit[1]); month = Number(explicit[2]); day = Number(explicit[3]); offset = 0; }
  if (offset < 0) return null;
  const result = new Date(Date.UTC(year, month - 1, day + offset, hour - 3, minute));
  return result.getTime() > now.getTime() ? result.toISOString() : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const valid = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.META_WHATSAPP_VERIFY_TOKEN;
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  return valid ? new NextResponse(challenge, { status: 200 }) : new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const id = requestId(request);
  if (contentLengthExceeds(request, MAX_WEBHOOK_BYTES)) return new NextResponse("Payload too large", { status: 413, headers: { "X-Request-Id": id } });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) return new NextResponse("Payload too large", { status: 413, headers: { "X-Request-Id": id } });
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    logServerEvent("warn", "whatsapp.invalid_signature", { requestId: id });
    return new NextResponse("Invalid signature", { status: 401, headers: { "X-Request-Id": id } });
  }
  let payload: MetaPayload;
  try { payload = JSON.parse(rawBody) as MetaPayload; } catch { return new NextResponse("Invalid JSON", { status: 400 }); }
  const value = payload.entry?.[0]?.changes?.find((change) => change.field === "messages")?.value;
  const incoming = value?.messages?.[0];
  const phoneNumberId = value?.metadata?.phone_number_id;
  if (!incoming?.id || !incoming.from || !phoneNumberId) return NextResponse.json({ received: true });
  if (incoming.type !== "text" || !incoming.text?.body?.trim()) return NextResponse.json({ received: true, ignored: "unsupported_message_type" });

  const supabase = createAdminClient();
  const { data: integration } = await supabase.from("integrations").select("agency_id").eq("provider", "whatsapp").eq("status", "connected").contains("public_config", { phone_number_id: phoneNumberId }).maybeSingle();
  if (!integration) return new NextResponse("Unknown phone number", { status: 404 });
  const agencyId = integration.agency_id;
  const { error: eventError } = await supabase.from("whatsapp_webhook_events").insert({ provider_message_id: incoming.id, agency_id: agencyId });
  if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (eventError) return new NextResponse("Event persistence failed", { status: 500 });

  const phone = normalizePhone(incoming.from);
  const { data: allowed } = await supabase.rpc("consume_api_rate_limit", { limit_bucket: "whatsapp_inbound", identity_value: `${agencyId}:${phone}`, maximum_requests: 60, window_seconds: 60 });
  if (!allowed) {
    logServerEvent("warn", "whatsapp.rate_limited", { requestId: id, agencyId });
    return NextResponse.json({ received: true, rateLimited: true }, { headers: { "X-Request-Id": id } });
  }
  let { data: conversation } = await supabase.from("conversations").select("id,status").eq("agency_id", agencyId).eq("channel", "whatsapp").eq("external_thread_id", phone).maybeSingle();
  const customerName = value?.contacts?.[0]?.profile?.name?.trim() || null;
  let lead: { id: string; status: string } | null = null;
  if (conversation) {
    const { data: existingConversation } = await supabase.from("conversations").select("lead_id").eq("id", conversation.id).eq("agency_id", agencyId).maybeSingle();
    if (existingConversation?.lead_id) {
      const result = await supabase.from("leads").select("id,status").eq("id", existingConversation.lead_id).eq("agency_id", agencyId).maybeSingle();
      lead = result.data;
    }
  }
  if (!lead) {
    const result = await supabase.from("leads").insert({ agency_id: agencyId, name: customerName, phone: incoming.from, source: "whatsapp", status: "new" }).select("id,status").single();
    lead = result.data;
  }
  if (!lead) return new NextResponse("Lead persistence failed", { status: 500 });

  if (!conversation) {
    const result = await supabase.from("conversations").insert({ agency_id: agencyId, lead_id: lead.id, channel: "whatsapp", status: "ai_active", external_thread_id: phone }).select("id,status").single();
    conversation = result.data;
  }
  if (!conversation) return new NextResponse("Conversation persistence failed", { status: 500 });

  const message = incoming.text.body.trim();
  await supabase.from("messages").insert({ agency_id: agencyId, conversation_id: conversation.id, sender_type: "customer", message, metadata: { provider: "meta_whatsapp", provider_message_id: incoming.id } });
  await supabase.rpc("record_whatsapp_usage", { target_agency_id: agencyId, message_count: 1 });
  if (conversation.status === "human_active") return NextResponse.json({ received: true, ai_paused: true });

  const [{ data: settings }, { data: history }] = await Promise.all([
    supabase.from("ai_settings").select("is_enabled,human_handoff_enabled,supported_languages,qualification_fields,business_rules").eq("agency_id", agencyId).maybeSingle(),
    supabase.from("messages").select("sender_type,message,metadata").eq("agency_id", agencyId).eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(30),
  ]);
  if (!settings?.is_enabled) return NextResponse.json({ received: true, ai_disabled: true });
  const orderedHistory = (history ?? []).reverse();
  const extraction = await extractChatRequirements(message, orderedHistory, { supportedLanguages: settings.supported_languages, qualificationFields: settings.qualification_fields, businessRules: settings.business_rules });
  const requirement = extraction.data;
  const awaitingViewingTime = orderedHistory.slice(-12).some((item) => item.sender_type === "ai" && /(?:taariikhda iyo saacadda viewing-ka|viewing date and time)/i.test(item.message));
  const parsedViewingTime = parseViewingTime(message);
  const viewingRequest = asksForViewing(message) || Boolean(parsedViewingTime && awaitingViewingTime);
  await supabase.from("leads").update({ name: requirement.name || customerName || undefined, phone: requirement.phone || incoming.from, email: requirement.email || undefined, purpose: requirement.purpose || undefined, district: requirement.district || undefined, budget_min: requirement.budget_min ?? undefined, budget_max: requirement.budget_max ?? undefined, bedrooms: requirement.bedrooms ?? undefined, property_type: requirement.property_type || undefined, furnished: requirement.furnished ?? undefined }).eq("id", lead.id).eq("agency_id", agencyId);
  if (viewingRequest) {
    const propertyId = orderedHistory.toReversed()
      .map((item) => item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? (item.metadata as Record<string, unknown>).property_id : null)
      .find((candidate): candidate is string => typeof candidate === "string" && /^[0-9a-f-]{36}$/i.test(candidate));
    const { data: property } = propertyId
      ? await supabase.from("properties").select("id,title").eq("id", propertyId).eq("agency_id", agencyId).eq("status", "available").maybeSingle()
      : { data: null };
    const startsAt = parsedViewingTime;
    let viewingId: string | null = null;
    let reply = !property
      ? "Property-ga aad viewing-ka u rabto lama xaqiijin. Fadlan marka hore dooro property-ga aad rabto."
      : !startsAt
        ? "Fadlan ii sheeg taariikhda iyo saacadda viewing-ka, tusaale: berri 4:00 galabnimo."
        : `Viewing-ga ${property.title} waxaa loo codsaday ${new Intl.DateTimeFormat("so-SO", { timeZone: "Africa/Mogadishu", dateStyle: "medium", timeStyle: "short" }).format(new Date(startsAt))}. Agency-ga ayaa xaqiijin doona.`;
    if (property && startsAt) {
      const result = await supabase.rpc("request_whatsapp_viewing", { target_agency_id: agencyId, target_conversation_id: conversation.id, target_property_id: property.id, requested_starts_at: startsAt });
      if (result.error) reply = /viewing time conflict/i.test(result.error.message) ? "Waqtigaas viewing kale ayaa property-ga uga qoran. Fadlan dooro waqti kale." : "Viewing-ga lama diiwaangelin karin. Fadlan dib u isku day.";
      else viewingId = result.data;
    }
    const outboundId = await sendWhatsAppText(agencyId, incoming.from, reply);
    await supabase.from("messages").insert({ agency_id: agencyId, conversation_id: conversation.id, sender_type: "ai", message: reply, metadata: { provider: "meta_whatsapp", provider_message_id: outboundId, viewing_id: viewingId, property_id: property?.id ?? null, starts_at: startsAt } });
    await supabase.rpc("record_whatsapp_usage", { target_agency_id: agencyId, message_count: 1 });
    return NextResponse.json({ received: true, viewingId });
  }
  const shouldSearch = requirement.intent === "property_search" && Boolean(requirement.purpose || requirement.district || requirement.budget_max || requirement.bedrooms || requirement.property_type || requirement.furnished !== null);
  let propertyCount = 0;
  if (shouldSearch) {
    const { data } = await supabase.rpc("search_widget_properties", { target_agency_id: agencyId, wanted_purpose: requirement.purpose, wanted_district: requirement.district, min_budget: requirement.budget_min, max_budget: requirement.budget_max, min_bedrooms: requirement.bedrooms, wanted_property_type: requirement.property_type, wanted_furnished: requirement.furnished });
    propertyCount = data?.length ?? 0;
  }
  const handoff = !viewingRequest && requirement.human_handoff && settings.human_handoff_enabled;
  const reply = handoff ? (requirement.language === "so" ? "Codsigaaga agent bani-aadam ah waa la gudbiyey. Qof ka tirsan agency-ga ayaa kula soo xiriiri doona." : "Your request for a human agent has been sent. Someone from the agency will contact you.") : shouldSearch ? formatPropertyReply(requirement.language, propertyCount) : requirement.reply;
  if (handoff) {
    await supabase.from("conversations").update({ status: "human_active" }).eq("id", conversation.id).eq("agency_id", agencyId);
    await supabase.from("notifications").insert({ agency_id: agencyId, type: "human_handoff", title: "WhatsApp human handoff", body: `${customerName || incoming.from} wuxuu codsaday agent.`, entity_type: "conversation", entity_id: conversation.id });
  }
  try {
    const outboundId = await sendWhatsAppText(agencyId, incoming.from, reply);
    await supabase.from("messages").insert({ agency_id: agencyId, conversation_id: conversation.id, sender_type: "ai", message: reply, metadata: { provider: "meta_whatsapp", provider_message_id: outboundId } });
    await supabase.rpc("record_whatsapp_usage", { target_agency_id: agencyId, message_count: 1 });
  } catch {
    await supabase.from("notifications").insert({ agency_id: agencyId, type: "whatsapp_send_failed", title: "WhatsApp reply failed", body: "AI reply-ga Meta looma diri karin.", entity_type: "conversation", entity_id: conversation.id });
    return new NextResponse("Outbound send failed", { status: 502 });
  }
  if (extraction.usedAI) await supabase.rpc("record_ai_usage", { target_agency_id: agencyId, input_token_count: extraction.usage.inputTokens, output_token_count: extraction.usage.outputTokens, estimated_cost: estimateAiCostUsd(extraction.usage.inputTokens, extraction.usage.outputTokens) });
  return NextResponse.json({ received: true });
}


import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { extractChatRequirements, formatPropertyReply } from "@/lib/ai/property-chat";
import { contentLengthExceeds, logServerEvent, MAX_WEBHOOK_BYTES, requestId } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateAiCostUsd } from "@/lib/usage/ai-cost";
import { sendWhatsAppImage, sendWhatsAppText } from "@/lib/whatsapp/meta";

type EvolutionPayload = {
  event?: string;
  instance?: string;
  data?: {
    key?: { id?: string; remoteJid?: string; fromMe?: boolean };
    pushName?: string;
    messageType?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { caption?: string };
      videoMessage?: { caption?: string };
    };
  };
};

function secureTokenMatch(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizePhone(value: string) { return value.replace(/@.*$/, "").replace(/\D/g, ""); }

function messageText(payload: EvolutionPayload) {
  const message = payload.data?.message;
  return (message?.conversation || message?.extendedTextMessage?.text || message?.imageMessage?.caption || message?.videoMessage?.caption || "").trim();
}

type MatchedProperty = {
  id: string;
  title: string;
  property_type: string;
  purpose: "rent" | "sale";
  district: string;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean;
  image_urls: unknown;
};

function asksToSeeProperty(message: string) {
  return /\b(i\s*tus|itus|soo\s+bandhig|sawir(?:ka|rada|ro)?|faahfaahin(?:ta)?|show\s+me|photos?|pictures?)\b/i.test(message);
}

function propertyCaption(property: MatchedProperty, language: "so" | "en") {
  const price = `${property.currency || "USD"} ${Number(property.price).toLocaleString()}`;
  if (language === "en") return `🏠 ${property.title}\n📍 ${property.district}\n💵 ${price}\n🛏 ${property.bedrooms ?? "—"} bedrooms · 🚿 ${property.bathrooms ?? "—"} bathrooms\n🪑 Furnished: ${property.furnished ? "Yes" : "No"}`;
  return `🏠 ${property.title}\n📍 ${property.district}\n💵 ${price}\n🛏 ${property.bedrooms ?? "—"} qol · 🚿 ${property.bathrooms ?? "—"} musqulood\n🪑 Furnished: ${property.furnished ? "Haa" : "Maya"}`;
}

function propertyImages(property: MatchedProperty) {
  if (!Array.isArray(property.image_urls)) return [];
  return property.image_urls.filter((value): value is string => typeof value === "string" && /^https:\/\//i.test(value)).slice(0, 3);
}

export async function POST(request: Request) {
  const id = requestId(request);
  const token = new URL(request.url).searchParams.get("token");
  if (!secureTokenMatch(token, process.env.EVOLUTION_WEBHOOK_TOKEN)) return new NextResponse("Forbidden", { status: 403 });
  if (contentLengthExceeds(request, MAX_WEBHOOK_BYTES)) return new NextResponse("Payload too large", { status: 413, headers: { "X-Request-Id": id } });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) return new NextResponse("Payload too large", { status: 413, headers: { "X-Request-Id": id } });
  let payload: EvolutionPayload;
  try { payload = JSON.parse(rawBody) as EvolutionPayload; } catch { return new NextResponse("Invalid JSON", { status: 400 }); }

  const expectedInstance = process.env.EVOLUTION_INSTANCE;
  const agencyId = process.env.EVOLUTION_AGENCY_ID;
  const remoteJid = payload.data?.key?.remoteJid || "";
  const incomingId = payload.data?.key?.id;
  if (payload.event?.toLowerCase() !== "messages.upsert" || payload.instance !== expectedInstance) return NextResponse.json({ received: true, ignored: "event_or_instance" });
  if (payload.data?.key?.fromMe || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") return NextResponse.json({ received: true, ignored: "outbound_or_group" });
  const message = messageText(payload);
  if (!agencyId || !/^[0-9a-f-]{36}$/i.test(agencyId)) return new NextResponse("Evolution agency is not configured", { status: 503 });
  if (!incomingId || !remoteJid || !message) return NextResponse.json({ received: true, ignored: "unsupported_message_type" });

  const phone = normalizePhone(remoteJid);
  if (!phone) return NextResponse.json({ received: true, ignored: "invalid_sender" });
  const supabase = createAdminClient();
  const { error: eventError } = await supabase.from("whatsapp_webhook_events").insert({ provider_message_id: `evolution:${incomingId}`, agency_id: agencyId });
  if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (eventError) return new NextResponse("Event persistence failed", { status: 500 });

  const { data: allowed } = await supabase.rpc("consume_api_rate_limit", { limit_bucket: "whatsapp_inbound", identity_value: `${agencyId}:${phone}`, maximum_requests: 60, window_seconds: 60 });
  if (!allowed) {
    logServerEvent("warn", "evolution.rate_limited", { requestId: id, agencyId });
    return NextResponse.json({ received: true, rateLimited: true });
  }

  let { data: conversation } = await supabase.from("conversations").select("id,status,lead_id").eq("agency_id", agencyId).eq("channel", "whatsapp").eq("external_thread_id", phone).maybeSingle();
  let lead: { id: string; status: string } | null = null;
  if (conversation?.lead_id) {
    const result = await supabase.from("leads").select("id,status").eq("id", conversation.lead_id).eq("agency_id", agencyId).maybeSingle();
    lead = result.data;
  }
  const customerName = payload.data?.pushName?.trim() || null;
  if (!lead) {
    const result = await supabase.from("leads").insert({ agency_id: agencyId, name: customerName, phone, source: "whatsapp", status: "new" }).select("id,status").single();
    lead = result.data;
  }
  if (!lead) return new NextResponse("Lead persistence failed", { status: 500 });
  if (!conversation) {
    const result = await supabase.from("conversations").insert({ agency_id: agencyId, lead_id: lead.id, channel: "whatsapp", status: "ai_active", external_thread_id: phone }).select("id,status,lead_id").single();
    conversation = result.data;
  }
  if (!conversation) return new NextResponse("Conversation persistence failed", { status: 500 });

  await supabase.from("messages").insert({ agency_id: agencyId, conversation_id: conversation.id, sender_type: "customer", message, metadata: { provider: "evolution_whatsapp", provider_message_id: incomingId } });
  await supabase.rpc("record_whatsapp_usage", { target_agency_id: agencyId, message_count: 1 });
  if (conversation.status === "human_active") return NextResponse.json({ received: true, ai_paused: true });

  const [{ data: settings }, { data: history }] = await Promise.all([
    supabase.from("ai_settings").select("is_enabled,human_handoff_enabled,supported_languages,qualification_fields,business_rules").eq("agency_id", agencyId).maybeSingle(),
    supabase.from("messages").select("sender_type,message").eq("agency_id", agencyId).eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!settings?.is_enabled) return NextResponse.json({ received: true, ai_disabled: true });
  const extraction = await extractChatRequirements(message, (history ?? []).reverse(), { supportedLanguages: settings.supported_languages, qualificationFields: settings.qualification_fields, businessRules: settings.business_rules });
  const requirement = extraction.data;
  const showRequest = asksToSeeProperty(message);
  await supabase.from("leads").update({ name: requirement.name || customerName || undefined, phone: requirement.phone || phone, email: requirement.email || undefined, purpose: requirement.purpose || undefined, district: requirement.district || undefined, budget_min: requirement.budget_min ?? undefined, budget_max: requirement.budget_max ?? undefined, bedrooms: requirement.bedrooms ?? undefined, property_type: requirement.property_type || undefined, furnished: requirement.furnished ?? undefined }).eq("id", lead.id).eq("agency_id", agencyId);
  const shouldSearch = (requirement.intent === "property_search" || showRequest) && Boolean(requirement.purpose || requirement.district || requirement.budget_max || requirement.bedrooms || requirement.property_type || requirement.furnished !== null);
  let properties: MatchedProperty[] = [];
  if (shouldSearch) {
    const { data, error } = await supabase.rpc("search_widget_properties", { target_agency_id: agencyId, wanted_purpose: requirement.purpose, wanted_district: requirement.district, min_budget: requirement.budget_min, max_budget: requirement.budget_max, min_bedrooms: requirement.bedrooms, wanted_property_type: requirement.property_type, wanted_furnished: requirement.furnished });
    if (error) {
      logServerEvent("error", "evolution.property_search_failed", { requestId: id, agencyId, error: error.message });
      return new NextResponse("Property search failed", { status: 500 });
    }
    properties = (data ?? []) as MatchedProperty[];
  }
  const handoff = !showRequest && requirement.human_handoff && settings.human_handoff_enabled;
  const selectedProperty = properties[0];
  const reply = handoff ? (requirement.language === "so" ? "Codsigaaga agent bani-aadam ah waa la gudbiyey. Qof ka tirsan agency-ga ayaa kula soo xiriiri doona." : "Your request for a human agent has been sent. Someone from the agency will contact you.") : selectedProperty ? propertyCaption(selectedProperty, requirement.language) : shouldSearch ? formatPropertyReply(requirement.language, properties.length) : requirement.reply;
  try {
    const outboundId = await sendWhatsAppText(agencyId, phone, reply);
    await supabase.from("messages").insert({ agency_id: agencyId, conversation_id: conversation.id, sender_type: "ai", message: reply, metadata: { provider: "evolution_whatsapp", provider_message_id: outboundId } });
    await supabase.rpc("record_whatsapp_usage", { target_agency_id: agencyId, message_count: 1 });
    if (selectedProperty) {
      for (const [index, imageUrl] of propertyImages(selectedProperty).entries()) {
        await sendWhatsAppImage(agencyId, phone, imageUrl, index === 0 ? propertyCaption(selectedProperty, requirement.language) : "");
        await supabase.rpc("record_whatsapp_usage", { target_agency_id: agencyId, message_count: 1 });
      }
    }
  } catch (error) {
    logServerEvent("error", "evolution.send_failed", { requestId: id, agencyId, error: error instanceof Error ? error.message : "unknown" });
    await supabase.from("notifications").insert({ agency_id: agencyId, type: "whatsapp_send_failed", title: "WhatsApp reply failed", body: "AI reply-ga Evolution looma diri karin.", entity_type: "conversation", entity_id: conversation.id });
    return new NextResponse("Outbound send failed", { status: 502 });
  }
  if (handoff) {
    await supabase.from("conversations").update({ status: "human_active" }).eq("id", conversation.id).eq("agency_id", agencyId);
    await supabase.from("notifications").insert({ agency_id: agencyId, type: "human_handoff", title: "WhatsApp human handoff", body: `${customerName || phone} wuxuu codsaday agent.`, entity_type: "conversation", entity_id: conversation.id });
  }
  if (extraction.usedAI) await supabase.rpc("record_ai_usage", { target_agency_id: agencyId, input_token_count: extraction.usage.inputTokens, output_token_count: extraction.usage.outputTokens, estimated_cost: estimateAiCostUsd(extraction.usage.inputTokens, extraction.usage.outputTokens) });
  return NextResponse.json({ received: true });
}


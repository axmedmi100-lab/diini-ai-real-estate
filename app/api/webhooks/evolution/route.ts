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

function asksForViewing(message: string) {
  return /\b(viewing|appointment|ball?an|booqasho|daawasho|so{1,2}\s+ark[ao]|so{1,2}\s+arki|arkaa|arko|daawado)\b/i.test(message);
}

function asksForViewingStatus(message: string) {
  return /(?:ma\s+la\s+(?:dii?waan(?:geliyey|galiyey|gashan)|qoray)|(?:viewing|booking|ballan|booqasho).{0,50}(?:goorma|dhacayaa|xaalad|status|xaqiiji|confirmed|dii?waan(?:geliyey|galiyey|gashan)))/i.test(message);
}

function canonicalDistrict(value: string | null) {
  if (!value) return null;
  const compact = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const aliases: Record<string, string> = {
    daarusalaam: "daaru salaam",
    daaralsalaam: "daaru salaam",
    darusalaam: "daaru salaam",
    saytuunvillage: "saytuun village",
  };
  return aliases[compact] ?? value.trim();
}

function parseSomaliViewingTime(message: string, now = new Date()) {
  const lower = message.toLowerCase();
  const time = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(subaxnimo|duhurnimo|galabnimo|fiidnimo|habeenimo|am|pm)?/i);
  if (!time) return null;
  let hour = Number(time[1]);
  const minute = Number(time[2] ?? 0);
  const period = time[3]?.toLowerCase();
  if (hour > 23 || minute > 59) return null;
  if (["galabnimo", "fiidnimo", "habeenimo", "pm"].includes(period ?? "") && hour < 12) hour += 12;
  if (["subaxnimo", "am"].includes(period ?? "") && hour === 12) hour = 0;

  const localParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Mogadishu", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(localParts.find((item) => item.type === type)?.value);
  let year = part("year");
  let month = part("month");
  let day = part("day");
  let dayOffset = /\b(berri|tomorrow)\b/i.test(lower) ? 1 : /\b(maanta|today)\b/i.test(lower) ? 0 : -1;
  const explicitDate = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (explicitDate) {
    year = Number(explicitDate[1]); month = Number(explicitDate[2]); day = Number(explicitDate[3]); dayOffset = 0;
  }
  if (dayOffset < 0) return null;
  const result = new Date(Date.UTC(year, month - 1, day + dayOffset, hour - 3, minute));
  return result.getTime() > now.getTime() ? result.toISOString() : null;
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
  let lead: { id: string; status: string; purpose?: "rent" | "sale" | null; district?: string | null; budget_min?: number | null; budget_max?: number | null; bedrooms?: number | null; property_type?: string | null; furnished?: boolean | null } | null = null;
  if (conversation?.lead_id) {
    const result = await supabase.from("leads").select("id,status,purpose,district,budget_min,budget_max,bedrooms,property_type,furnished").eq("id", conversation.lead_id).eq("agency_id", agencyId).maybeSingle();
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
  if (asksForViewingStatus(message)) {
    const { data: viewing, error: viewingError } = await supabase.from("viewings")
      .select("id,property_id,starts_at,status")
      .eq("agency_id", agencyId)
      .eq("lead_id", lead.id)
      .in("status", ["requested", "confirmed"])
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (viewingError) {
      logServerEvent("error", "evolution.viewing_status_failed", { requestId: id, agencyId, error: viewingError.message });
      return new NextResponse("Viewing status lookup failed", { status: 500 });
    }
    let propertyTitle = "property-ga";
    if (viewing?.property_id) {
      const { data: property } = await supabase.from("properties").select("title").eq("id", viewing.property_id).eq("agency_id", agencyId).maybeSingle();
      if (property?.title) propertyTitle = property.title;
    }
    const reply = viewing
      ? `Haa, viewing-ga ${propertyTitle} waa la diiwaangeliyey ${new Intl.DateTimeFormat("so-SO", { timeZone: "Africa/Mogadishu", dateStyle: "medium", timeStyle: "short" }).format(new Date(viewing.starts_at))}. ${viewing.status === "confirmed" ? "Agency-gu wuu xaqiijiyey." : "Weli wuxuu sugayaa xaqiijinta agency-ga."}`
      : "Weli ma helin viewing kuu diiwaangashan oo soo socda. Fadlan dooro property-ga, taariikhda iyo saacadda aad rabto.";
    const outboundId = await sendWhatsAppText(agencyId, phone, reply);
    await supabase.from("messages").insert({ agency_id: agencyId, conversation_id: conversation.id, sender_type: "ai", message: reply, metadata: { provider: "evolution_whatsapp", provider_message_id: outboundId, viewing_id: viewing?.id ?? null, viewing_status: viewing?.status ?? null } });
    await supabase.rpc("record_whatsapp_usage", { target_agency_id: agencyId, message_count: 1 });
    return NextResponse.json({ received: true, viewingId: viewing?.id ?? null, viewingStatus: viewing?.status ?? null });
  }
  if (conversation.status === "human_active") return NextResponse.json({ received: true, ai_paused: true });

  const [{ data: settings }, { data: history }] = await Promise.all([
    supabase.from("ai_settings").select("is_enabled,human_handoff_enabled,supported_languages,qualification_fields,business_rules").eq("agency_id", agencyId).maybeSingle(),
    supabase.from("messages").select("sender_type,message").eq("agency_id", agencyId).eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!settings?.is_enabled) return NextResponse.json({ received: true, ai_disabled: true });
  const orderedHistory = (history ?? []).reverse();
  const extraction = await extractChatRequirements(message, orderedHistory, { supportedLanguages: settings.supported_languages, qualificationFields: settings.qualification_fields, businessRules: settings.business_rules });
  const requirement = extraction.data;
  const showRequest = asksToSeeProperty(message);
  const parsedViewingTime = parseSomaliViewingTime(message);
  const awaitingViewingTime = orderedHistory.slice(-4).some((item) => item.sender_type === "ai" && /(?:taariikhda iyo saacadda viewing-ka|viewing date and time)/i.test(item.message));
  const viewingRequest = asksForViewing(message) || Boolean(parsedViewingTime && awaitingViewingTime);
  await supabase.from("leads").update({ name: requirement.name || customerName || undefined, phone: requirement.phone || phone, email: requirement.email || undefined, purpose: requirement.purpose || undefined, district: requirement.district || undefined, budget_min: requirement.budget_min ?? undefined, budget_max: requirement.budget_max ?? undefined, bedrooms: requirement.bedrooms ?? undefined, property_type: requirement.property_type || undefined, furnished: requirement.furnished ?? undefined }).eq("id", lead.id).eq("agency_id", agencyId);
  const searchRequirement = {
    purpose: requirement.purpose ?? lead.purpose ?? null,
    district: canonicalDistrict(requirement.district ?? lead.district ?? null),
    budget_min: requirement.budget_min ?? lead.budget_min ?? null,
    budget_max: requirement.budget_max ?? lead.budget_max ?? null,
    bedrooms: requirement.bedrooms ?? lead.bedrooms ?? null,
    property_type: requirement.property_type ?? lead.property_type ?? null,
    furnished: requirement.furnished ?? lead.furnished ?? null,
  };
  const shouldSearch = (requirement.intent === "property_search" || showRequest || viewingRequest) && Boolean(searchRequirement.purpose || searchRequirement.district || searchRequirement.budget_max || searchRequirement.bedrooms || searchRequirement.property_type || searchRequirement.furnished !== null);
  let properties: MatchedProperty[] = [];
  if (shouldSearch) {
    const search = (propertyType: string | null) => supabase.rpc("search_widget_properties", { target_agency_id: agencyId, wanted_purpose: searchRequirement.purpose, wanted_district: searchRequirement.district, min_budget: searchRequirement.budget_min, max_budget: searchRequirement.budget_max, min_bedrooms: searchRequirement.bedrooms, wanted_property_type: propertyType, wanted_furnished: searchRequirement.furnished });
    let { data, error } = await search(searchRequirement.property_type);
    if (!error && !(data?.length) && !requirement.property_type && searchRequirement.property_type) {
      ({ data, error } = await search(null));
    }
    if (error) {
      logServerEvent("error", "evolution.property_search_failed", { requestId: id, agencyId, error: error.message });
      return new NextResponse("Property search failed", { status: 500 });
    }
    properties = (data ?? []) as MatchedProperty[];
  }
  const handoff = !showRequest && requirement.human_handoff && settings.human_handoff_enabled;
  let selectedProperty: MatchedProperty | undefined = properties[0];
  if (viewingRequest && !selectedProperty) {
    const { data: recentPropertyMessages } = await supabase.from("messages")
      .select("metadata")
      .eq("agency_id", agencyId)
      .eq("conversation_id", conversation.id)
      .eq("sender_type", "ai")
      .order("created_at", { ascending: false })
      .limit(20);
    const recentPropertyId = recentPropertyMessages
      ?.map((item) => item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? (item.metadata as Record<string, unknown>).property_id : null)
      .find((propertyId): propertyId is string => typeof propertyId === "string" && /^[0-9a-f-]{36}$/i.test(propertyId));
    if (recentPropertyId) {
      const { data: recentProperty } = await supabase.from("properties")
        .select("id,title,property_type,purpose,district,price,currency,bedrooms,bathrooms,furnished,image_urls")
        .eq("id", recentPropertyId)
        .eq("agency_id", agencyId)
        .eq("status", "available")
        .maybeSingle();
      selectedProperty = (recentProperty as MatchedProperty | null) ?? undefined;
    }
  }
  if (viewingRequest) {
    const startsAt = parsedViewingTime;
    const bookingReply = !selectedProperty
      ? "Property-ga aad viewing-ka u rabto lama xaqiijin. Fadlan marka hore dooro property-ga aad rabto."
      : !startsAt
        ? "Fadlan ii sheeg taariikhda iyo saacadda viewing-ka, tusaale: berri 4:00 galabnimo."
        : `Viewing-ga ${selectedProperty.title} waxaa loo codsaday ${new Intl.DateTimeFormat("so-SO", { timeZone: "Africa/Mogadishu", dateStyle: "medium", timeStyle: "short" }).format(new Date(startsAt))}. Agency-ga ayaa xaqiijin doona.`;
    let viewingId: string | null = null;
    if (selectedProperty && startsAt) {
      const result = await supabase.rpc("request_whatsapp_viewing", { target_agency_id: agencyId, target_conversation_id: conversation.id, target_property_id: selectedProperty.id, requested_starts_at: startsAt });
      if (result.error) {
        logServerEvent("error", "evolution.viewing_failed", { requestId: id, agencyId, error: result.error.message });
        return new NextResponse("Viewing request failed", { status: 500 });
      }
      viewingId = result.data;
    }
    const outboundId = await sendWhatsAppText(agencyId, phone, bookingReply);
    await supabase.from("messages").insert({ agency_id: agencyId, conversation_id: conversation.id, sender_type: "ai", message: bookingReply, metadata: { provider: "evolution_whatsapp", provider_message_id: outboundId, viewing_id: viewingId, property_id: selectedProperty?.id ?? null, starts_at: startsAt } });
    await supabase.rpc("record_whatsapp_usage", { target_agency_id: agencyId, message_count: 1 });
    return NextResponse.json({ received: true, viewingId });
  }
  const reply = handoff ? (requirement.language === "so" ? "Codsigaaga agent bani-aadam ah waa la gudbiyey. Qof ka tirsan agency-ga ayaa kula soo xiriiri doona." : "Your request for a human agent has been sent. Someone from the agency will contact you.") : selectedProperty ? propertyCaption(selectedProperty, requirement.language) : shouldSearch ? formatPropertyReply(requirement.language, properties.length) : requirement.reply;
  try {
    const outboundId = await sendWhatsAppText(agencyId, phone, reply);
    await supabase.from("messages").insert({ agency_id: agencyId, conversation_id: conversation.id, sender_type: "ai", message: reply, metadata: { provider: "evolution_whatsapp", provider_message_id: outboundId, property_id: selectedProperty?.id ?? null } });
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


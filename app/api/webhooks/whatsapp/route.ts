import { NextResponse } from "next/server";

import { extractChatRequirements, formatPropertyReply } from "@/lib/ai/property-chat";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateAiCostUsd } from "@/lib/usage/ai-cost";
import { sendWhatsAppText, verifyMetaSignature } from "@/lib/whatsapp/meta";

type MetaMessage = { from?: string; id?: string; type?: string; text?: { body?: string } };
type MetaValue = { metadata?: { phone_number_id?: string }; contacts?: Array<{ profile?: { name?: string } }>; messages?: MetaMessage[] };
type MetaPayload = { entry?: Array<{ changes?: Array<{ field?: string; value?: MetaValue }> }> };

function normalizePhone(value: string) { return value.replace(/\D/g, ""); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const valid = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.META_WHATSAPP_VERIFY_TOKEN;
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  return valid ? new NextResponse(challenge, { status: 200 }) : new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) return new NextResponse("Invalid signature", { status: 401 });
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
  const customerName = value?.contacts?.[0]?.profile?.name?.trim() || null;
  let { data: customer } = await supabase.from("customers").select("id,name").eq("agency_id", agencyId).eq("normalized_phone", phone).maybeSingle();
  if (!customer) {
    const result = await supabase.from("customers").insert({ agency_id: agencyId, name: customerName, phone: incoming.from, normalized_phone: phone, metadata: { whatsapp_wa_id: incoming.from } }).select("id,name").single();
    customer = result.data;
  } else if (!customer.name && customerName) await supabase.from("customers").update({ name: customerName }).eq("id", customer.id).eq("agency_id", agencyId);
  if (!customer) return new NextResponse("Customer persistence failed", { status: 500 });

  let { data: lead } = await supabase.from("leads").select("id,status").eq("agency_id", agencyId).eq("customer_id", customer.id).eq("source", "whatsapp").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!lead) {
    const result = await supabase.from("leads").insert({ agency_id: agencyId, customer_id: customer.id, name: customerName, phone: incoming.from, source: "whatsapp", status: "new" }).select("id,status").single();
    lead = result.data;
  }
  if (!lead) return new NextResponse("Lead persistence failed", { status: 500 });

  let { data: conversation } = await supabase.from("conversations").select("id,status").eq("agency_id", agencyId).eq("channel", "whatsapp").eq("external_thread_id", phone).maybeSingle();
  if (!conversation) {
    const result = await supabase.from("conversations").insert({ agency_id: agencyId, customer_id: customer.id, lead_id: lead.id, channel: "whatsapp", status: "ai_active", external_thread_id: phone }).select("id,status").single();
    conversation = result.data;
  }
  if (!conversation) return new NextResponse("Conversation persistence failed", { status: 500 });

  const message = incoming.text.body.trim();
  await supabase.from("messages").insert({ agency_id: agencyId, conversation_id: conversation.id, sender_type: "customer", message, metadata: { provider: "meta_whatsapp", provider_message_id: incoming.id } });
  await supabase.rpc("record_whatsapp_usage", { target_agency_id: agencyId, message_count: 1 });
  if (conversation.status === "human_active") return NextResponse.json({ received: true, ai_paused: true });

  const [{ data: settings }, { data: history }] = await Promise.all([
    supabase.from("ai_settings").select("is_enabled,human_handoff_enabled,supported_languages,qualification_fields,business_rules").eq("agency_id", agencyId).maybeSingle(),
    supabase.from("messages").select("sender_type,message").eq("agency_id", agencyId).eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!settings?.is_enabled) return NextResponse.json({ received: true, ai_disabled: true });
  const extraction = await extractChatRequirements(message, (history ?? []).reverse(), { supportedLanguages: settings.supported_languages, qualificationFields: settings.qualification_fields, businessRules: settings.business_rules });
  const requirement = extraction.data;
  await supabase.from("leads").update({ name: requirement.name || customerName || undefined, phone: requirement.phone || incoming.from, email: requirement.email || undefined, purpose: requirement.purpose || undefined, district: requirement.district || undefined, budget_min: requirement.budget_min ?? undefined, budget_max: requirement.budget_max ?? undefined, bedrooms: requirement.bedrooms ?? undefined, property_type: requirement.property_type || undefined, furnished: requirement.furnished ?? undefined }).eq("id", lead.id).eq("agency_id", agencyId);
  const shouldSearch = Boolean(requirement.purpose || requirement.district || requirement.budget_max || requirement.bedrooms || requirement.property_type || requirement.furnished !== null);
  let propertyCount = 0;
  if (shouldSearch) {
    const { data } = await supabase.rpc("search_widget_properties", { target_agency_id: agencyId, wanted_purpose: requirement.purpose, wanted_district: requirement.district, min_budget: requirement.budget_min, max_budget: requirement.budget_max, min_bedrooms: requirement.bedrooms, wanted_property_type: requirement.property_type, wanted_furnished: requirement.furnished });
    propertyCount = data?.length ?? 0;
  }
  const handoff = requirement.human_handoff && settings.human_handoff_enabled;
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

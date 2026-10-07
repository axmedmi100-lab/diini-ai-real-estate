import { NextResponse } from "next/server";

import { extractChatRequirements, formatPropertyReply } from "@/lib/ai/property-chat";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { estimateAiCostUsd } from "@/lib/usage/ai-cost";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requests = new Map<string, { count: number; resetAt: number }>();

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function rateLimited(token: string) {
  const now = Date.now();
  const current = requests.get(token);
  if (!current || current.resetAt < now) {
    requests.set(token, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 30;
}

export async function GET(request: Request) {
  const agencyId = new URL(request.url).searchParams.get("agencyId") ?? "";
  if (!uuidPattern.test(agencyId)) return bad("Agency ID-ga sax ma aha.");
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_widget_config", { target_agency_id: agencyId });
  if (error || !data) return bad("Agency widget-ka lama helin.", 404);
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60" } });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad("Request-ku JSON sax ah ma aha."); }
  const action = String(body.action ?? "");
  const agencyId = String(body.agencyId ?? "");
  const sessionToken = String(body.sessionToken ?? "");
  if (!uuidPattern.test(agencyId) || !uuidPattern.test(sessionToken)) return bad("Widget session-ka sax ma aha.");
  if (rateLimited(sessionToken)) return bad("Fariimo badan ayaa la diray. Sug hal daqiiqo.", 429);
  const supabase = createPublicClient();

  const { data: config, error: configError } = await supabase.rpc("get_widget_config", { target_agency_id: agencyId });
  if (configError || !config) {
    console.error("Widget config RPC failed", configError);
    return bad("Agency widget-ka lama helin.", 404);
  }
  if (!config.is_enabled) return bad("AI chat-ka agency-gan weli lama hawlgelin.", 403);

  if (action === "start") {
    const { data, error } = await supabase.rpc("start_widget_conversation", { target_agency_id: agencyId, session_token: sessionToken });
    if (error) return bad("Conversation-ka lama bilaabi karin.", 500);
    const conversationId = data.conversation_id as string;
    const { data: messages } = await supabase.rpc("get_widget_messages", { target_agency_id: agencyId, target_conversation_id: conversationId, session_token: sessionToken });
    return NextResponse.json({ conversationId, messages: messages ?? [], config });
  }

  if (action === "book_viewing") {
    const conversationId = String(body.conversationId ?? "");
    const propertyId = String(body.propertyId ?? "");
    const startsAt = String(body.startsAt ?? "");
    if (!uuidPattern.test(conversationId) || !uuidPattern.test(propertyId) || !startsAt || Number.isNaN(Date.parse(startsAt))) return bad("Viewing request-ku sax ma aha.");
    if (Date.parse(startsAt) <= Date.now()) return bad("Dooro waqti mustaqbalka ah.");
    const { data: viewingId, error } = await supabase.rpc("request_widget_viewing", { target_agency_id: agencyId, target_conversation_id: conversationId, session_token: sessionToken, target_property_id: propertyId, requested_starts_at: startsAt });
    if (error) {
      console.error("Widget viewing RPC failed", error);
      return bad("Viewing-ga lama codsan karin. Hubi property-ga iyo waqtiga.", 400);
    }
    return NextResponse.json({ viewingId, message: "Viewing-ga waa la codsaday. Agency-gu wuxuu xaqiijin doonaa waqtiga." });
  }

  if (action !== "message") return bad("Action-ka lama aqoonsan.");
  const conversationId = String(body.conversationId ?? "");
  const message = String(body.message ?? "").trim();
  if (!uuidPattern.test(conversationId) || !message || message.length > 2000) return bad("Fariintu sax ma aha.");
  const { data: history, error: historyError } = await supabase.rpc("get_widget_messages", { target_agency_id: agencyId, target_conversation_id: conversationId, session_token: sessionToken });
  if (historyError) return bad("Conversation-ka lama xaqiijin.", 403);
  const { data: conversationStatus, error: stateError } = await supabase.rpc("get_widget_conversation_state", { target_agency_id: agencyId, target_conversation_id: conversationId, session_token: sessionToken });
  if (stateError || !conversationStatus) return bad("Conversation-ka lama xaqiijin.", 403);
  if (conversationStatus === "human_active") {
    const { error: customerMessageError } = await supabase.rpc("append_widget_customer_message", {
      target_agency_id: agencyId,
      target_conversation_id: conversationId,
      session_token: sessionToken,
      customer_message: message,
    });
    if (customerMessageError) return bad("Fariinta lama kaydin.", 500);
    return NextResponse.json({ message: null, properties: [], usedAI: false, humanHandoff: true, aiPaused: true });
  }

  let extraction;
  try {
    extraction = await extractChatRequirements(message, history ?? [], { supportedLanguages: config.supported_languages, qualificationFields: config.qualification_fields, businessRules: config.business_rules });
  } catch {
    extraction = await extractChatRequirements(message, []);
  }
  const requirement = extraction.data;
  const shouldSearch = Boolean(requirement.purpose || requirement.district || requirement.budget_max || requirement.bedrooms || requirement.property_type || requirement.furnished !== null);
  let properties: Array<Record<string, unknown>> = [];
  if (shouldSearch) {
    const { data } = await supabase.rpc("search_widget_properties", {
      target_agency_id: agencyId,
      wanted_purpose: requirement.purpose,
      wanted_district: requirement.district,
      min_budget: requirement.budget_min,
      max_budget: requirement.budget_max,
      min_bedrooms: requirement.bedrooms,
      wanted_property_type: requirement.property_type,
      wanted_furnished: requirement.furnished,
    });
    properties = data ?? [];
  }
  const assistantMessage = requirement.human_handoff && config.human_handoff_enabled
    ? requirement.language === "so"
      ? "Codsigaaga agent bani-aadam ah waa la gudbiyey. Qof ka tirsan agency-ga ayaa kula soo xiriiri doona."
      : "Your request for a human agent has been sent. Someone from the agency will contact you."
    : shouldSearch
      ? formatPropertyReply(requirement.language, properties.length)
      : requirement.reply;
  const meaningfulLead = shouldSearch || requirement.name || requirement.phone || requirement.email;
  if (meaningfulLead) {
    await supabase.rpc("upsert_widget_lead", {
      target_agency_id: agencyId,
      target_conversation_id: conversationId,
      session_token: sessionToken,
      lead_name: requirement.name,
      lead_phone: requirement.phone,
      lead_email: requirement.email,
      wanted_purpose: requirement.purpose,
      wanted_district: requirement.district,
      min_budget: requirement.budget_min,
      max_budget: requirement.budget_max,
      min_bedrooms: requirement.bedrooms,
      wanted_property_type: requirement.property_type,
      wanted_furnished: requirement.furnished,
    });
    if (requirement.timeline) await supabase.rpc("set_widget_lead_timeline", { target_agency_id: agencyId, target_conversation_id: conversationId, session_token: sessionToken, wanted_timeline: requirement.timeline });
  }
  if (requirement.human_handoff && config.human_handoff_enabled) {
    const { error: handoffError } = await supabase.rpc("request_widget_handoff", {
      target_agency_id: agencyId,
      target_conversation_id: conversationId,
      session_token: sessionToken,
    });
    if (handoffError) return bad("Codsiga agent-ka lama gudbin.", 500);
  }
  const { error: saveError } = await supabase.rpc("append_widget_exchange", {
    target_agency_id: agencyId,
    target_conversation_id: conversationId,
    session_token: sessionToken,
    customer_message: message,
    assistant_message: assistantMessage,
  });
  if (saveError) return bad("AI-ga conversation-kan waa la hakiyey ama fariinta lama kaydin.", 409);
  if (extraction.usedAI) {
    try {
      const { error: usageError } = await createAdminClient().rpc("record_ai_usage", {
        target_agency_id: agencyId,
        input_token_count: extraction.usage.inputTokens,
        output_token_count: extraction.usage.outputTokens,
        estimated_cost: estimateAiCostUsd(extraction.usage.inputTokens, extraction.usage.outputTokens),
      });
      if (usageError) console.error("AI usage metering failed", usageError);
    } catch (usageError) {
      console.error("AI usage metering unavailable", usageError);
    }
  }
  return NextResponse.json({ message: assistantMessage, properties, usedAI: extraction.usedAI, humanHandoff: requirement.human_handoff });
}

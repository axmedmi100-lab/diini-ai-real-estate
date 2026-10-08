"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";
import { sendWhatsAppText } from "@/lib/whatsapp/meta";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }

export async function setConversationMode(formData: FormData) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const conversationId = value(formData, "conversation_id"); const mode = value(formData, "mode");
  if (!hasAgencyPermission(membership.role, "manage_conversations")) redirect(`/conversations/${conversationId}?error=Ma lihid oggolaanshahan.`);
  if (!new Set(["human_active", "ai_active"]).has(mode)) redirect(`/conversations/${conversationId}?error=Mode-ka sax ma aha.`);
  if (mode === "human_active") {
    const { error } = await supabase.rpc("assign_conversation_agent", { target_conversation_id: conversationId, target_member_id: membership.id });
    if (error) redirect(`/conversations/${conversationId}?error=Conversation-ka lama la wareegi karin.`);
    redirect(`/conversations/${conversationId}?message=Adiga ayaa laguu xilsaaray; AI-ga waa la hakiyey.`);
  }
  const { error } = await supabase.from("conversations").update({ status: mode, assigned_agent_id: null }).eq("id", conversationId).eq("agency_id", agency.id);
  if (error) redirect(`/conversations/${conversationId}?error=Conversation mode-ka lama beddeli karin.`);
  await supabase.from("audit_logs").insert({ agency_id: agency.id, user_id: user.id, action: mode === "human_active" ? "conversation.takeover" : "conversation.returned_to_ai", entity_type: "conversation", entity_id: conversationId, metadata: { mode } });
  redirect(`/conversations/${conversationId}?message=${mode === "human_active" ? "Agent-ku wuu la wareegay; AI-ga waa la hakiyey." : "Conversation-ka si cad ayaa AI loogu celiyey."}`);
}

export async function assignConversation(formData: FormData) {
  const { supabase, membership } = await getAgencyWorkspace();
  const conversationId = value(formData, "conversation_id");
  const memberId = value(formData, "member_id");
  if (!hasAgencyPermission(membership.role, "assign_conversations")) redirect(`/conversations/${conversationId}?error=Ma lihid awoodda assignment-ka.`);
  const { error } = await supabase.rpc("assign_conversation_agent", { target_conversation_id: conversationId, target_member_id: memberId });
  if (error) redirect(`/conversations/${conversationId}?error=Agent-ka lama xilsaarin.`);
  redirect(`/conversations/${conversationId}?message=Agent-ka waa la xilsaaray; notification-na waa loo diray.`);
}

export async function sendAgentMessage(formData: FormData) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const conversationId = value(formData, "conversation_id"); const message = value(formData, "message");
  if (!hasAgencyPermission(membership.role, "manage_conversations")) redirect(`/conversations/${conversationId}?error=Ma lihid oggolaanshahan.`);
  if (!message || message.length > 4000) redirect(`/conversations/${conversationId}?error=Fariintu sax ma aha.`);
  const { data: conversation } = await supabase.from("conversations").select("status,channel,external_thread_id").eq("id", conversationId).eq("agency_id", agency.id).maybeSingle();
  if (conversation?.status !== "human_active") redirect(`/conversations/${conversationId}?error=Marka hore Take over samee.`);
  let providerMessageId: string | undefined;
  if (conversation.channel === "whatsapp" && conversation.external_thread_id) {
    try { providerMessageId = await sendWhatsAppText(agency.id, conversation.external_thread_id, message); }
    catch { redirect(`/conversations/${conversationId}?error=WhatsApp message-ka Meta looma diri karin.`); }
  }
  const { error } = await supabase.from("messages").insert({ agency_id: agency.id, conversation_id: conversationId, sender_type: "agent", sender_user_id: user.id, message, metadata: providerMessageId ? { provider: "meta_whatsapp", provider_message_id: providerMessageId } : {} });
  if (error) redirect(`/conversations/${conversationId}?error=Fariinta lama kaydin.`);
  if (providerMessageId) await supabase.rpc("record_whatsapp_usage", { target_agency_id: agency.id, message_count: 1 });
  await supabase.from("audit_logs").insert({ agency_id: agency.id, user_id: user.id, action: "conversation.agent_message", entity_type: "conversation", entity_id: conversationId, metadata: {} });
  redirect(`/conversations/${conversationId}?message=Fariinta agent-ka waa la kaydiyey.`);
}

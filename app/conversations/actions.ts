"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }

export async function setConversationMode(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const conversationId = value(formData, "conversation_id"); const mode = value(formData, "mode");
  if (!hasAgencyPermission(membership.role, "manage_conversations")) redirect(`/conversations/${conversationId}?error=Ma lihid oggolaanshahan.`);
  if (!new Set(["human_active", "ai_active"]).has(mode)) redirect(`/conversations/${conversationId}?error=Mode-ka sax ma aha.`);
  const { error } = await supabase.from("conversations").update({ status: mode }).eq("id", conversationId).eq("agency_id", agency.id);
  if (error) redirect(`/conversations/${conversationId}?error=Conversation mode-ka lama beddeli karin.`);
  redirect(`/conversations/${conversationId}?message=${mode === "human_active" ? "Agent-ku wuu la wareegay; AI-ga waa la hakiyey." : "Conversation-ka si cad ayaa AI loogu celiyey."}`);
}

export async function sendAgentMessage(formData: FormData) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const conversationId = value(formData, "conversation_id"); const message = value(formData, "message");
  if (!hasAgencyPermission(membership.role, "manage_conversations")) redirect(`/conversations/${conversationId}?error=Ma lihid oggolaanshahan.`);
  if (!message || message.length > 4000) redirect(`/conversations/${conversationId}?error=Fariintu sax ma aha.`);
  const { data: conversation } = await supabase.from("conversations").select("status").eq("id", conversationId).eq("agency_id", agency.id).maybeSingle();
  if (conversation?.status !== "human_active") redirect(`/conversations/${conversationId}?error=Marka hore Take over samee.`);
  const { error } = await supabase.from("messages").insert({ agency_id: agency.id, conversation_id: conversationId, sender_type: "agent", sender_user_id: user.id, message });
  if (error) redirect(`/conversations/${conversationId}?error=Fariinta lama kaydin.`);
  redirect(`/conversations/${conversationId}?message=Fariinta agent-ka waa la kaydiyey.`);
}

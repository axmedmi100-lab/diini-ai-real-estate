"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function createFollowUpRule(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_automation")) redirect("/follow-ups?error=Ma lihid oggolaanshaha rules-ka.");
  const delayMinutes = Number(text(formData, "delay_minutes"));
  const maximum = Number(text(formData, "max_follow_ups"));
  const name = text(formData, "name"); const template = text(formData, "message_template");
  if (!name || !template || !Number.isInteger(delayMinutes) || delayMinutes < 5 || delayMinutes > 43200 || !Number.isInteger(maximum) || maximum < 1 || maximum > 5) redirect("/follow-ups?error=Rule-ka xogtiisu sax ma aha.");
  const { error } = await supabase.from("follow_up_rules").insert({ agency_id: agency.id, name, delay_minutes: delayMinutes, channel: text(formData, "channel") || "website", message_template: template, max_follow_ups: maximum, is_enabled: true });
  if (error) redirect("/follow-ups?error=Rule-ka lama kaydin.");
  redirect("/follow-ups?message=Follow-up rule-ka waa la abuuray.");
}

export async function toggleFollowUpRule(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_automation")) redirect("/follow-ups?error=Ma lihid oggolaanshaha rules-ka.");
  const { error } = await supabase.from("follow_up_rules").update({ is_enabled: text(formData, "enabled") === "true" }).eq("id", text(formData, "rule_id")).eq("agency_id", agency.id);
  if (error) redirect("/follow-ups?error=Rule-ka lama beddeli karin.");
  redirect("/follow-ups?message=Rule-ka waa la cusboonaysiiyey.");
}

export async function scheduleFollowUp(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect("/follow-ups?error=Ma lihid oggolaanshaha follow-up cusub.");
  const leadId = text(formData, "lead_id"); const scheduledFor = new Date(text(formData, "scheduled_for")); const template = text(formData, "message_template");
  if (!leadId || !template || Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) redirect("/follow-ups?error=Lead, fariin iyo waqti mustaqbal ah waa waajib.");
  const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).eq("agency_id", agency.id).maybeSingle();
  if (!lead) redirect("/follow-ups?error=Lead-ka lama helin.");
  const { data: conversation } = await supabase.from("conversations").select("id").eq("agency_id", agency.id).eq("lead_id", leadId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("follow_ups").insert({ agency_id: agency.id, lead_id: leadId, conversation_id: conversation?.id ?? null, channel: text(formData, "channel") || "website", scheduled_for: scheduledFor.toISOString(), message_template: template });
  if (error) redirect("/follow-ups?error=Follow-up-ka lama jadwalayn.");
  redirect("/follow-ups?message=Follow-up-ka waa la jadwaleeyey.");
}

export async function cancelFollowUp(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect("/follow-ups?error=Ma lihid oggolaanshaha cancel-ka.");
  const { error } = await supabase.from("follow_ups").update({ status: "cancelled" }).eq("id", text(formData, "follow_up_id")).eq("agency_id", agency.id).eq("status", "pending");
  if (error) redirect("/follow-ups?error=Follow-up-ka lama cancel-gareyn.");
  redirect("/follow-ups?message=Follow-up-ka waa la cancel-gareeyey.");
}

export async function setCustomerOptOut(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect("/follow-ups?error=Ma lihid oggolaanshahan.");
  const optedOut = text(formData, "opted_out") === "true";
  const customerId = text(formData, "customer_id");
  const { error } = await supabase.from("customers").update({ follow_up_opted_out: optedOut, follow_up_opted_out_at: optedOut ? new Date().toISOString() : null }).eq("id", customerId).eq("agency_id", agency.id);
  if (error) redirect("/follow-ups?error=Opt-out-ka lama kaydin.");
  if (optedOut) {
    const { data: leads } = await supabase.from("leads").select("id").eq("agency_id", agency.id).eq("customer_id", customerId);
    const leadIds = leads?.map((item) => item.id) ?? [];
    if (leadIds.length > 0) {
      await supabase.from("follow_ups").update({ status: "opted_out" }).eq("agency_id", agency.id).eq("status", "pending").in("lead_id", leadIds);
    }
  }
  redirect("/follow-ups?message=Customer preference-ka waa la kaydiyey.");
}

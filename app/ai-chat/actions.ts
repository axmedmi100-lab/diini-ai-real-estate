"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";

function text(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }

export async function updateAIChatSettings(formData: FormData) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_ai")) redirect("/ai-chat?error=Ma lihid oggolaanshaha AI settings-ka.");
  const assistantName = text(formData, "assistant_name");
  if (assistantName.length < 2) redirect("/ai-chat?error=Magaca assistant-ku aad buu u gaaban yahay.");
  const supportedLanguages = ["so", "en"].filter((value) => formData.get(`language_${value}`) === "on");
  if (!supportedLanguages.length) redirect("/ai-chat?error=Ugu yaraan hal luqad dooro.");
  const allowedFields = ["purpose", "district", "budget", "bedrooms", "property_type", "furnished", "timeline"];
  const qualificationFields = allowedFields.filter((value) => formData.get(`qualify_${value}`) === "on");
  if (!qualificationFields.length) redirect("/ai-chat?error=Ugu yaraan hal qualification field dooro.");
  const readyWithinDays = Math.min(365, Math.max(1, Number(formData.get("ready_within_days") || 30)));
  const isEnabled = formData.get("is_enabled") === "on";
  const { error } = await supabase.from("ai_settings").upsert({
    agency_id: agency.id,
    assistant_name: assistantName,
    welcome_message_so: text(formData, "welcome_message_so") || null,
    welcome_message_en: text(formData, "welcome_message_en") || null,
    human_handoff_enabled: formData.get("human_handoff_enabled") === "on",
    is_enabled: isEnabled,
    supported_languages: supportedLanguages,
    qualification_fields: qualificationFields,
    hot_lead_rules: {
      contact_details: formData.get("hot_contact_details") === "on",
      budget_known: formData.get("hot_budget_known") === "on",
      viewing_requested: formData.get("hot_viewing_requested") === "on",
      ready_within_days: readyWithinDays,
    },
    handoff_rules: {
      customer_requests_human: formData.get("handoff_customer_requests_human") === "on",
      complaint: formData.get("handoff_complaint") === "on",
      negotiation: formData.get("handoff_negotiation") === "on",
      low_confidence: formData.get("handoff_low_confidence") === "on",
    },
    business_rules: text(formData, "business_rules") || null,
  }, { onConflict: "agency_id" });
  if (error) redirect("/ai-chat?error=AI settings-ka lama kaydin.");
  await supabase.from("integrations").upsert({ agency_id: agency.id, provider: "website_ai", status: isEnabled ? "connected" : "disconnected", connected_at: isEnabled ? new Date().toISOString() : null }, { onConflict: "agency_id,provider" });
  await supabase.from("audit_logs").insert({ agency_id: agency.id, user_id: user.id, action: "ai_settings.updated", entity_type: "ai_settings", metadata: { supported_languages: supportedLanguages, qualification_fields: qualificationFields, website_ai_enabled: isEnabled } });
  redirect("/ai-chat?message=AI chat settings-ka waa la kaydiyey.");
}

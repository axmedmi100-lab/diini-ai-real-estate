"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";

function text(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }

export async function updateAIChatSettings(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!["owner", "admin", "manager"].includes(membership.role)) redirect("/ai-chat?error=Ma lihid oggolaanshaha AI settings-ka.");
  const assistantName = text(formData, "assistant_name");
  if (assistantName.length < 2) redirect("/ai-chat?error=Magaca assistant-ku aad buu u gaaban yahay.");
  const { error } = await supabase.from("ai_settings").upsert({
    agency_id: agency.id,
    assistant_name: assistantName,
    welcome_message_so: text(formData, "welcome_message_so") || null,
    welcome_message_en: text(formData, "welcome_message_en") || null,
    human_handoff_enabled: formData.get("human_handoff_enabled") === "on",
    is_enabled: formData.get("is_enabled") === "on",
    supported_languages: ["so", "en"],
  }, { onConflict: "agency_id" });
  if (error) redirect("/ai-chat?error=AI settings-ka lama kaydin.");
  redirect("/ai-chat?message=AI chat settings-ka waa la kaydiyey.");
}

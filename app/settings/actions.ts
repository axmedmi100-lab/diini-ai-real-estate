"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function updateAgency(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_agency")) redirect("/settings?error=Ma lihid oggolaanshaha settings-ka.");

  const name = field(formData, "name");
  if (name.length < 2) redirect("/settings?error=Magaca agency-gu aad buu u gaaban yahay.");

  const { error } = await supabase.from("agencies").update({
    name,
    phone: field(formData, "phone") || null,
    whatsapp: field(formData, "whatsapp") || null,
    email: field(formData, "email") || null,
    website: field(formData, "website") || null,
    address: field(formData, "address") || null,
    default_language: field(formData, "default_language") || "so",
    default_currency: field(formData, "default_currency").toUpperCase() || "USD",
    timezone: field(formData, "timezone") || "Africa/Mogadishu",
  }).eq("id", agency.id);

  if (error) redirect(`/settings?error=${encodeURIComponent("Settings-ka lama kaydin. Hubi xogta.")}`);
  redirect("/settings?message=Settings-ka agency-ga waa la kaydiyey.");
}

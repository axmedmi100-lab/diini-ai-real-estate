"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

const allowedLogoTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
]);

export async function updateAgencyLogo(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_agency")) redirect("/settings?error=Ma lihid oggolaanshaha logo-ga.");
  const logo = formData.get("logo");
  if (!(logo instanceof File) || !logo.size) redirect("/settings?error=Dooro sawirka logo-ga.");
  if (logo.size > 2 * 1024 * 1024) redirect("/settings?error=Logo-gu waa inuu ka yaraadaa 2 MB.");
  const extension = allowedLogoTypes.get(logo.type);
  if (!extension) redirect("/settings?error=Logo-gu waa inuu noqdaa PNG ama JPG si PDF-yada loogu daabaco.");

  const path = `${agency.id}/logo.${extension}`;
  const { error: uploadError } = await supabase.storage.from("agency-branding").upload(path, logo, { contentType: logo.type, upsert: true, cacheControl: "3600" });
  if (uploadError) redirect(`/settings?error=${encodeURIComponent("Logo-ga lama upload-gareyn. Hubi branding migration-ka.")}`);
  const { data } = supabase.storage.from("agency-branding").getPublicUrl(path);
  const logoUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error } = await supabase.from("agencies").update({ logo_url: logoUrl }).eq("id", agency.id);
  if (error) redirect("/settings?error=Logo-ga lama kaydin.");
  revalidatePath("/", "layout");
  redirect("/settings?message=Logo-ga agency-ga waa la kaydiyey.");
}

export async function removeAgencyLogo() {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_agency")) redirect("/settings?error=Ma lihid oggolaanshaha logo-ga.");
  const { data: files } = await supabase.storage.from("agency-branding").list(agency.id);
  if (files?.length) await supabase.storage.from("agency-branding").remove(files.map((file) => `${agency.id}/${file.name}`));
  await supabase.from("agencies").update({ logo_url: null }).eq("id", agency.id);
  revalidatePath("/", "layout");
  redirect("/settings?message=Logo-ga waa laga saaray; DIINI logo ayaa default noqday.");
}


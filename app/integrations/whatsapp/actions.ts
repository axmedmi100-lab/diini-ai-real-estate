"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";
import { validateWhatsAppPhone } from "@/lib/whatsapp/meta";

export async function connectWhatsApp(formData: FormData) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_agency")) redirect("/integrations/whatsapp?error=Ma lihid oggolaanshahan.");
  const phoneNumberId = String(formData.get("phone_number_id") ?? "").trim();
  const businessAccountId = String(formData.get("business_account_id") ?? "").trim();
  const secretReference = String(formData.get("secret_reference") ?? "").trim();
  if (!/^\d{5,30}$/.test(phoneNumberId) || !/^\d{5,30}$/.test(businessAccountId) || !/^[A-Z][A-Z0-9_]{5,100}$/.test(secretReference)) redirect("/integrations/whatsapp?error=Meta IDs ama token environment variable-ku sax ma aha.");
  const token = process.env[secretReference];
  if (!token) redirect(`/integrations/whatsapp?error=${encodeURIComponent(`${secretReference} lagama helin server environment-ka.`)}`);
  let profile;
  try { profile = await validateWhatsAppPhone(phoneNumberId, token); } catch { redirect("/integrations/whatsapp?error=Meta credentials lama xaqiijin karin."); }
  const { error } = await supabase.from("integrations").update({ status: "connected", external_account_id: businessAccountId, public_config: { phone_number_id: phoneNumberId, business_account_id: businessAccountId, display_phone_number: profile.display_phone_number, verified_name: profile.verified_name }, secret_reference: secretReference, connected_at: new Date().toISOString() }).eq("agency_id", agency.id).eq("provider", "whatsapp");
  if (error) redirect("/integrations/whatsapp?error=WhatsApp connection-ka lama kaydin.");
  await supabase.from("audit_logs").insert({ agency_id: agency.id, user_id: user.id, action: "integration.whatsapp_connected", entity_type: "integration", metadata: { phone_number_id: phoneNumberId, business_account_id: businessAccountId } });
  redirect("/integrations/whatsapp?message=WhatsApp Cloud API waa connected.");
}

export async function disconnectWhatsApp() {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_agency")) redirect("/integrations/whatsapp?error=Ma lihid oggolaanshahan.");
  await supabase.from("integrations").update({ status: "disconnected", connected_at: null }).eq("agency_id", agency.id).eq("provider", "whatsapp");
  await supabase.from("audit_logs").insert({ agency_id: agency.id, user_id: user.id, action: "integration.whatsapp_disconnected", entity_type: "integration", metadata: {} });
  redirect("/integrations/whatsapp?message=WhatsApp waa la disconnect-gareeyey.");
}

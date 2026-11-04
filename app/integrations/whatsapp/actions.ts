"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { configureEvolutionWebhook, createEvolutionInstance, getEvolutionInstanceForAgency, logoutEvolutionInstance } from "@/lib/whatsapp/evolution";
import { validateWhatsAppPhone } from "@/lib/whatsapp/meta";

export async function connectEvolutionWhatsApp() {
  const { user, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_agency")) redirect("/integrations/whatsapp?error=Ma lihid oggolaanshahan.");
  if (process.env.EVOLUTION_ENABLED !== "true") redirect("/integrations/whatsapp?error=Evolution API-ga platform-ka lama hawlgelin.");
  const admin = createAdminClient();
  const { data: integration } = await admin.from("integrations").select("platform_enabled").eq("agency_id", agency.id).eq("provider", "whatsapp").maybeSingle();
  if (integration && !integration.platform_enabled) redirect("/integrations/whatsapp?error=WhatsApp agency-gan platform-ka ayaa ka xanniban.");
  try {
    const instance = await createEvolutionInstance(agency.id);
    await configureEvolutionWebhook(instance.instanceName);
    await admin.from("integrations").upsert({ agency_id: agency.id, provider: "whatsapp", status: "disconnected", platform_enabled: true, public_config: { provider_mode: "evolution", instance_name: instance.instanceName } }, { onConflict: "agency_id,provider" });
    await admin.from("audit_logs").insert({ agency_id: agency.id, user_id: user.id, action: "integration.evolution_created", entity_type: "integration", metadata: { instance_name: instance.instanceName } });
  } catch (error) {
    redirect(`/integrations/whatsapp?error=${encodeURIComponent(error instanceof Error ? error.message : "Evolution instance lama abuuri karin.")}`);
  }
  redirect("/integrations/whatsapp?message=QR code-ka waa diyaar. Telefoonka macmiilka ku scan-garee.");
}

export async function refreshEvolutionWhatsApp() {
  const { membership } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_agency")) redirect("/integrations/whatsapp?error=Ma lihid oggolaanshahan.");
  redirect("/integrations/whatsapp");
}

export async function disconnectEvolutionWhatsApp() {
  const { user, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_agency")) redirect("/integrations/whatsapp?error=Ma lihid oggolaanshahan.");
  const instance = await getEvolutionInstanceForAgency(agency.id);
  if (!instance) redirect("/integrations/whatsapp?error=Evolution instance lama helin.");
  try { await logoutEvolutionInstance(instance.instanceName); } catch (error) {
    redirect(`/integrations/whatsapp?error=${encodeURIComponent(error instanceof Error ? error.message : "WhatsApp lama disconnect-gareyn karin.")}`);
  }
  const admin = createAdminClient();
  if (!instance.legacy) await admin.from("evolution_instances").update({ connection_status: "disconnected", owner_jid: null, connected_at: null }).eq("agency_id", agency.id);
  await admin.from("integrations").update({ status: "disconnected", connected_at: null }).eq("agency_id", agency.id).eq("provider", "whatsapp");
  await admin.from("audit_logs").insert({ agency_id: agency.id, user_id: user.id, action: "integration.evolution_disconnected", entity_type: "integration", metadata: { instance_name: instance.instanceName } });
  redirect("/integrations/whatsapp?message=WhatsApp waa la disconnect-gareeyey. QR cusub ayaad dib ugu xiriirin kartaa.");
}

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


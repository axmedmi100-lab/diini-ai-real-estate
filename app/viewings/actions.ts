"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { agencyDateTimeLocalToUtc, formatAgencyDateTime } from "@/lib/date-time";
import { hasAgencyPermission } from "@/lib/permissions";
import { sendWhatsAppText } from "@/lib/whatsapp/meta";

const statuses = new Set(["requested", "confirmed", "completed", "cancelled", "no_show"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function createViewing(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_viewings")) redirect("/viewings?error=Ma lihid oggolaanshaha viewing cusub.");
  const leadId = value(formData, "lead_id");
  const propertyId = value(formData, "property_id");
  const agentId = value(formData, "agent_id") || null;
  const startsAt = agencyDateTimeLocalToUtc(value(formData, "starts_at"), agency.timezone);
  if (!leadId || !propertyId || !startsAt) redirect("/viewings/new?error=Lead, property iyo waqtiga waa waajib.");
  if (startsAt.getTime() <= Date.now()) redirect("/viewings/new?error=Waqtiga viewing-ku waa inuu mustaqbalka noqdaa.");

  const [{ data: lead }, { data: property }, agentResult] = await Promise.all([
    supabase.from("leads").select("id").eq("id", leadId).eq("agency_id", agency.id).maybeSingle(),
    supabase.from("properties").select("id").eq("id", propertyId).eq("agency_id", agency.id).maybeSingle(),
    agentId ? supabase.from("agency_members").select("id").eq("id", agentId).eq("agency_id", agency.id).eq("is_active", true).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!lead || !property || (agentId && !agentResult.data)) redirect("/viewings/new?error=Xogta la doortay agency-gan kama tirsana.");

  const { data: viewing, error } = await supabase.from("viewings").insert({ agency_id: agency.id, lead_id: leadId, property_id: propertyId, agent_id: agentId, starts_at: startsAt.toISOString(), status: "requested", notes: value(formData, "notes") || null }).select("id").single();
  if (error) redirect("/viewings/new?error=Viewing-ga lama abuuri karin.");
  await Promise.all([
    supabase.from("leads").update({ status: "viewing" }).eq("id", leadId).eq("agency_id", agency.id),
    supabase.from("notifications").insert({ agency_id: agency.id, type: "viewing_requested", title: "Viewing cusub", body: "Viewing cusub ayaa la qorsheeyey.", entity_type: "viewing", entity_id: viewing.id }),
  ]);
  redirect(`/viewings/${viewing.id}?message=Viewing-ga waa la abuuray.`);
}

export async function updateViewing(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const viewingId = value(formData, "viewing_id");
  if (!hasAgencyPermission(membership.role, "manage_viewings")) redirect(`/viewings/${viewingId}?error=Ma lihid oggolaanshaha isbeddelkan.`);
  const status = value(formData, "status");
  const agentId = value(formData, "agent_id") || null;
  const startsAt = agencyDateTimeLocalToUtc(value(formData, "starts_at"), agency.timezone);
  if (!statuses.has(status) || !startsAt) redirect(`/viewings/${viewingId}?error=Status ama waqtiga sax ma aha.`);
  const { data: existingViewing } = await supabase.from("viewings").select("id,lead_id,property_id,status").eq("id", viewingId).eq("agency_id", agency.id).maybeSingle();
  if (!existingViewing) redirect(`/viewings/${viewingId}?error=Viewing-ga lama helin.`);
  if (agentId) {
    const { data: agent } = await supabase.from("agency_members").select("id").eq("id", agentId).eq("agency_id", agency.id).eq("is_active", true).maybeSingle();
    if (!agent) redirect(`/viewings/${viewingId}?error=Agent-ku agency-gan kama tirsana.`);
  }
  const { error } = await supabase.from("viewings").update({ status, agent_id: agentId, starts_at: startsAt.toISOString(), notes: value(formData, "notes") || null }).eq("id", viewingId).eq("agency_id", agency.id);
  if (error) redirect(`/viewings/${viewingId}?error=Viewing-ga lama cusboonaysiin karin.`);
  let confirmationNotice = "Viewing-ga waa la cusboonaysiiyey.";
  if (status === "confirmed" && existingViewing.status !== "confirmed") {
    const [{ data: property }, { data: conversation }] = await Promise.all([
      supabase.from("properties").select("title").eq("id", existingViewing.property_id).eq("agency_id", agency.id).maybeSingle(),
      supabase.from("conversations").select("id,external_thread_id").eq("agency_id", agency.id).eq("lead_id", existingViewing.lead_id).eq("channel", "whatsapp").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (conversation?.external_thread_id) {
      const confirmation = `Viewing-gaaga ${property?.title || "property-ga"} waa la xaqiijiyey ${formatAgencyDateTime(startsAt, agency.timezone)}.`;
      try {
        const providerMessageId = await sendWhatsAppText(agency.id, conversation.external_thread_id, confirmation);
        await Promise.all([
          supabase.from("messages").insert({ agency_id: agency.id, conversation_id: conversation.id, sender_type: "system", message: confirmation, metadata: { provider: "evolution_whatsapp", provider_message_id: providerMessageId, viewing_id: viewingId, status: "confirmed" } }),
          supabase.rpc("record_whatsapp_usage", { target_agency_id: agency.id, message_count: 1 }),
        ]);
        confirmationNotice = "Viewing-ga waa la xaqiijiyey; customer-kana WhatsApp ayaa loo diray.";
      } catch {
        await supabase.from("notifications").insert({ agency_id: agency.id, type: "whatsapp_send_failed", title: "Viewing confirmation failed", body: "Viewing-ga waa la xaqiijiyey, laakiin WhatsApp confirmation-ka lama dirin.", entity_type: "viewing", entity_id: viewingId });
        confirmationNotice = "Viewing-ga waa la xaqiijiyey, laakiin WhatsApp confirmation-ka lama dirin.";
      }
    }
  }
  redirect(`/viewings/${viewingId}?message=${encodeURIComponent(confirmationNotice)}`);
}


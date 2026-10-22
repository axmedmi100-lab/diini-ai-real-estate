"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { agencyDateTimeLocalToUtc, formatAgencyDateTime } from "@/lib/date-time";
import { hasAgencyPermission } from "@/lib/permissions";
import { sendWhatsAppText } from "@/lib/whatsapp/meta";

const statuses = new Set(["requested", "confirmed", "completed", "cancelled", "no_show"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

async function hasViewingConflict(supabase: Awaited<ReturnType<typeof getAgencyWorkspace>>["supabase"], agencyId: string, startsAt: Date, propertyId: string, agentId: string | null, excludeViewingId?: string) {
  const from = new Date(startsAt.getTime() - 60 * 60_000).toISOString();
  const until = new Date(startsAt.getTime() + 60 * 60_000).toISOString();
  let propertyQuery = supabase.from("viewings").select("id").eq("agency_id", agencyId).eq("property_id", propertyId).in("status", ["requested", "confirmed"]).gt("starts_at", from).lt("starts_at", until).limit(1);
  let agentQuery = agentId ? supabase.from("viewings").select("id").eq("agency_id", agencyId).eq("agent_id", agentId).in("status", ["requested", "confirmed"]).gt("starts_at", from).lt("starts_at", until).limit(1) : null;
  if (excludeViewingId) {
    propertyQuery = propertyQuery.neq("id", excludeViewingId);
    if (agentQuery) agentQuery = agentQuery.neq("id", excludeViewingId);
  }
  const [propertyResult, agentResult] = await Promise.all([propertyQuery, agentQuery ?? Promise.resolve({ data: [] })]);
  return { property: Boolean(propertyResult.data?.length), agent: Boolean(agentResult.data?.length) };
}

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
  const conflict = await hasViewingConflict(supabase, agency.id, startsAt, propertyId, agentId);
  if (conflict.property) redirect("/viewings/new?error=Property-gan viewing kale ayaa waqtigan uga qoran. Dooro waqti kale.");
  if (conflict.agent) redirect("/viewings/new?error=Agent-kan viewing kale ayuu waqtigan leeyahay. Dooro agent ama waqti kale.");

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
  const conflict = await hasViewingConflict(supabase, agency.id, startsAt, existingViewing.property_id, agentId, viewingId);
  if (conflict.property) redirect(`/viewings/${viewingId}?error=Property-gan viewing kale ayaa waqtigan uga qoran. Dooro waqti kale.`);
  if (conflict.agent) redirect(`/viewings/${viewingId}?error=Agent-kan viewing kale ayuu waqtigan leeyahay. Dooro agent ama waqti kale.`);
  const { error } = await supabase.from("viewings").update({ status, agent_id: agentId, starts_at: startsAt.toISOString(), notes: value(formData, "notes") || null }).eq("id", viewingId).eq("agency_id", agency.id);
  if (error) redirect(`/viewings/${viewingId}?error=Viewing-ga lama cusboonaysiin karin.`);
  let confirmationNotice = "Viewing-ga waa la cusboonaysiiyey.";
  if (status === "confirmed") {
    const [{ data: property }, { data: conversation }] = await Promise.all([
      supabase.from("properties").select("title").eq("id", existingViewing.property_id).eq("agency_id", agency.id).maybeSingle(),
      supabase.from("conversations").select("id,external_thread_id").eq("agency_id", agency.id).eq("lead_id", existingViewing.lead_id).eq("channel", "whatsapp").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (conversation?.external_thread_id) {
      const confirmation = `Viewing-gaaga ${property?.title || "property-ga"} waa la xaqiijiyey ${formatAgencyDateTime(startsAt, agency.timezone)}.`;
      if (existingViewing.status !== "confirmed") {
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
      const now = Date.now();
      const reminders = [
        { minutes: 1440, label: "24 saac" },
        { minutes: 120, label: "2 saac" },
      ].map(({ minutes, label }) => ({
        agency_id: agency.id,
        lead_id: existingViewing.lead_id,
        conversation_id: conversation.id,
        viewing_id: viewingId,
        reminder_offset_minutes: minutes,
        channel: "whatsapp" as const,
        scheduled_for: new Date(startsAt.getTime() - minutes * 60_000).toISOString(),
        message_template: `Xasuusin (${label} kahor): Viewing-gaaga ${property?.title || "property-ga"} wuxuu dhacayaa ${formatAgencyDateTime(startsAt, agency.timezone)}.`,
        status: "pending",
        attempt_count: 0,
        sent_at: null,
        last_error: null,
        processing_started_at: null,
        provider_message_id: null,
      })).filter((item) => new Date(item.scheduled_for).getTime() > now);
      if (reminders.length) {
        const { error: reminderError } = await supabase.from("follow_ups").upsert(reminders, { onConflict: "viewing_id,reminder_offset_minutes" });
        if (reminderError) {
          await supabase.from("notifications").insert({ agency_id: agency.id, type: "viewing_reminder_failed", title: "Viewing reminder lama jadwalin", body: reminderError.message, entity_type: "viewing", entity_id: viewingId });
          confirmationNotice = "Viewing-ga waa la kaydiyey, laakiin reminders-ka lama jadwalin.";
        } else if (existingViewing.status === "confirmed") {
          confirmationNotice = "Viewing reminders-ka waa la jadwaleeyey.";
        }
      }
    }
  } else {
    await supabase.from("follow_ups").update({ status: "cancelled" }).eq("agency_id", agency.id).eq("viewing_id", viewingId).in("status", ["pending", "processing"]);
  }
  if (["completed", "no_show"].includes(status) && existingViewing.status !== status) {
    const [{ data: property }, { data: conversation }] = await Promise.all([
      supabase.from("properties").select("title").eq("id", existingViewing.property_id).eq("agency_id", agency.id).maybeSingle(),
      supabase.from("conversations").select("id,external_thread_id").eq("agency_id", agency.id).eq("lead_id", existingViewing.lead_id).eq("channel", "whatsapp").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (conversation?.external_thread_id) {
      const propertyTitle = property?.title || "property-ga";
      const outcomeMessage = status === "completed"
        ? `Viewing-ga ${propertyTitle} wuu dhammaaday. Ma xiisaynaysaa property-gan, mise waxaad rabtaa inaan kuu raadiyo mid kale?`
        : `Waxaad seegtay viewing-gii ${propertyTitle}. Ma rabtaa inaan kuu qabanno taariikh iyo saacad kale?`;
      try {
        const providerMessageId = await sendWhatsAppText(agency.id, conversation.external_thread_id, outcomeMessage);
        await Promise.all([
          supabase.from("messages").insert({ agency_id: agency.id, conversation_id: conversation.id, sender_type: "system", message: outcomeMessage, metadata: { provider: "evolution_whatsapp", provider_message_id: providerMessageId, viewing_id: viewingId, status } }),
          supabase.rpc("record_whatsapp_usage", { target_agency_id: agency.id, message_count: 1 }),
        ]);
        confirmationNotice = status === "completed" ? "Viewing-ga waa la dhammaystiray; customer-ka follow-up ayaa loo diray." : "No-show waa la kaydiyey; customer-ka rebooking ayaa loo diray.";
      } catch {
        await supabase.from("notifications").insert({ agency_id: agency.id, type: "whatsapp_send_failed", title: "Viewing outcome message failed", body: "Status-ka waa la kaydiyey, laakiin WhatsApp follow-up-ka lama dirin.", entity_type: "viewing", entity_id: viewingId });
        confirmationNotice = "Status-ka waa la kaydiyey, laakiin WhatsApp follow-up-ka lama dirin.";
      }
    }
  }
  redirect(`/viewings/${viewingId}?message=${encodeURIComponent(confirmationNotice)}`);
}


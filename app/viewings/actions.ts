"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";

const allowedRoles = new Set(["owner", "admin", "manager", "agent", "receptionist"]);
const statuses = new Set(["requested", "confirmed", "completed", "cancelled", "no_show"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function createViewing(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!allowedRoles.has(membership.role)) redirect("/viewings?error=Ma lihid oggolaanshaha viewing cusub.");
  const leadId = value(formData, "lead_id");
  const propertyId = value(formData, "property_id");
  const agentId = value(formData, "agent_id") || null;
  const startsAt = new Date(value(formData, "starts_at"));
  if (!leadId || !propertyId || Number.isNaN(startsAt.getTime())) redirect("/viewings/new?error=Lead, property iyo waqtiga waa waajib.");
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
  if (!allowedRoles.has(membership.role)) redirect(`/viewings/${viewingId}?error=Ma lihid oggolaanshaha isbeddelkan.`);
  const status = value(formData, "status");
  const agentId = value(formData, "agent_id") || null;
  const startsAt = new Date(value(formData, "starts_at"));
  if (!statuses.has(status) || Number.isNaN(startsAt.getTime())) redirect(`/viewings/${viewingId}?error=Status ama waqtiga sax ma aha.`);
  if (agentId) {
    const { data: agent } = await supabase.from("agency_members").select("id").eq("id", agentId).eq("agency_id", agency.id).eq("is_active", true).maybeSingle();
    if (!agent) redirect(`/viewings/${viewingId}?error=Agent-ku agency-gan kama tirsana.`);
  }
  const { error } = await supabase.from("viewings").update({ status, agent_id: agentId, starts_at: startsAt.toISOString(), notes: value(formData, "notes") || null }).eq("id", viewingId).eq("agency_id", agency.id);
  if (error) redirect(`/viewings/${viewingId}?error=Viewing-ga lama cusboonaysiin karin.`);
  redirect(`/viewings/${viewingId}?message=Viewing-ga waa la cusboonaysiiyey.`);
}

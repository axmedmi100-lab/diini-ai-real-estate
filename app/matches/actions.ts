"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { matchProperty } from "@/lib/matching/property-matcher";
import { hasAgencyPermission } from "@/lib/permissions";

export async function prepareMatchOutreach(formData: FormData) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const leadId = String(formData.get("lead_id") ?? "");
  const propertyId = String(formData.get("property_id") ?? "");
  const requestedReturn = String(formData.get("return_to") ?? "");
  const returnTo = requestedReturn.startsWith("/leads/") || requestedReturn.startsWith("/properties/") ? requestedReturn : `/leads/${leadId}`;
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect(`${returnTo}?error=Ma lihid oggolaanshaha outreach-ka.`);
  const [{ data: lead }, { data: property }] = await Promise.all([
    supabase.from("leads").select("id,purpose,district,budget_min,budget_max,bedrooms,property_type,furnished").eq("id", leadId).eq("agency_id", agency.id).maybeSingle(),
    supabase.from("properties").select("id,purpose,status,district,price,bedrooms,property_type,furnished").eq("id", propertyId).eq("agency_id", agency.id).eq("status", "available").maybeSingle(),
  ]);
  if (!lead || !property) redirect(`${returnTo}?error=Lead-ka ama property-ga lama helin.`);
  const match = matchProperty({ purpose: lead.purpose, district: lead.district, budget_min: lead.budget_min === null ? null : Number(lead.budget_min), budget_max: lead.budget_max === null ? null : Number(lead.budget_max), bedrooms: lead.bedrooms, property_type: lead.property_type, furnished: lead.furnished }, { ...property, price: Number(property.price) });
  if (!match) redirect(`${returnTo}?error=Property-gu kama gudbin hard filters-ka lead-kan.`);
  const { error } = await supabase.from("lead_property_matches").upsert({ agency_id: agency.id, lead_id: leadId, property_id: propertyId, score: match.score, reasons: match.reasons, status: "outreach_draft", prepared_by: user.id }, { onConflict: "lead_id,property_id" });
  if (error) redirect(`${returnTo}?error=Outreach draft-ka lama kaydin.`);
  await supabase.from("audit_logs").insert({ agency_id: agency.id, user_id: user.id, action: "property_match.outreach_prepared", entity_type: "lead", entity_id: leadId, metadata: { property_id: propertyId, score: match.score } });
  redirect(`${returnTo}?message=Property match-ka waxaa loo diyaariyey outreach. Wax fariin ah wali lama dirin.`);
}

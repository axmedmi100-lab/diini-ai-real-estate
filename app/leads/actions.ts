"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";


function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function numberOrNull(formData: FormData, name: string) {
  const value = text(formData, name);
  return value === "" ? null : Number(value);
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits || null;
}

function leadPayload(formData: FormData) {
  return {
    name: text(formData, "name") || null,
    phone: text(formData, "phone") || null,
    email: text(formData, "email").toLowerCase() || null,
    source: text(formData, "source") || "manual",
    purpose: text(formData, "purpose") || null,
    district: text(formData, "district") || null,
    budget_min: numberOrNull(formData, "budget_min"),
    budget_max: numberOrNull(formData, "budget_max"),
    bedrooms: numberOrNull(formData, "bedrooms"),
    property_type: text(formData, "property_type") || null,
    furnished: text(formData, "furnished") === "any" ? null : formData.get("furnished") === "true",
    timeline: text(formData, "timeline") || null,
    status: text(formData, "status") || "new",
    assigned_agent_id: text(formData, "assigned_agent_id") || null,
    notes: text(formData, "notes") || null,
  };
}

function validateLead(payload: ReturnType<typeof leadPayload>) {
  if (!payload.name && !payload.phone && !payload.email) return "Geli magaca, phone-ka ama email-ka lead-ka.";
  if (payload.budget_min !== null && (!Number.isFinite(payload.budget_min) || payload.budget_min < 0)) return "Minimum budget-ku sax ma aha.";
  if (payload.budget_max !== null && (!Number.isFinite(payload.budget_max) || payload.budget_max < 0)) return "Maximum budget-ku sax ma aha.";
  if (payload.budget_min !== null && payload.budget_max !== null && payload.budget_max < payload.budget_min) return "Maximum budget-ku kama yaraan karo minimum-ka.";
  return null;
}

async function ensureCustomer(supabase: Awaited<ReturnType<typeof getAgencyWorkspace>>["supabase"], agencyId: string, payload: ReturnType<typeof leadPayload>, currentCustomerId?: string | null) {
  const normalizedPhone = payload.phone ? normalizePhone(payload.phone) : null;
  if (currentCustomerId) {
    await supabase.from("customers").update({ name: payload.name, phone: payload.phone, normalized_phone: normalizedPhone, email: payload.email }).eq("id", currentCustomerId).eq("agency_id", agencyId);
    return { id: currentCustomerId, created: false };
  }
  if (normalizedPhone) {
    const { data: existing } = await supabase.from("customers").select("id").eq("agency_id", agencyId).eq("normalized_phone", normalizedPhone).maybeSingle();
    if (existing) return { id: existing.id, created: false };
  }
  const { data: customer, error } = await supabase.from("customers").insert({ agency_id: agencyId, name: payload.name, phone: payload.phone, normalized_phone: normalizedPhone, email: payload.email }).select("id").single();
  if (error) throw error;
  return { id: customer.id, created: true };
}

export async function createLead(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect("/leads?error=Ma lihid oggolaanshaha lead cusub.");
  const payload = leadPayload(formData);
  const errorMessage = validateLead(payload);
  if (errorMessage) redirect(`/leads/new?error=${encodeURIComponent(errorMessage)}`);
  let customer: { id: string; created: boolean };
  try {
    customer = await ensureCustomer(supabase, agency.id, payload);
  } catch {
    redirect("/leads/new?error=Customer-ka lama kaydin.");
  }
  const { data: lead, error } = await supabase.from("leads").insert({ agency_id: agency.id, customer_id: customer.id, ...payload }).select("id").single();
  if (error) {
    if (customer.created) await supabase.from("customers").delete().eq("id", customer.id).eq("agency_id", agency.id);
    redirect("/leads/new?error=Lead-ka lama kaydin. Hubi xogta.");
  }
  redirect(`/leads/${lead.id}?message=Lead-ka waa la abuuray.`);
}

export async function updateLead(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const leadId = text(formData, "lead_id");
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect(`/leads/${leadId}?error=Ma lihid oggolaanshaha edit-ka.`);
  const payload = leadPayload(formData);
  const errorMessage = validateLead(payload);
  if (errorMessage) redirect(`/leads/${leadId}/edit?error=${encodeURIComponent(errorMessage)}`);
  const { data: current } = await supabase.from("leads").select("customer_id").eq("id", leadId).eq("agency_id", agency.id).maybeSingle();
  if (!current) redirect("/leads?error=Lead-ka lama helin.");
  try {
    const customer = await ensureCustomer(supabase, agency.id, payload, current.customer_id);
    const { error } = await supabase.from("leads").update({ ...payload, customer_id: customer.id }).eq("id", leadId).eq("agency_id", agency.id);
    if (error) throw error;
  } catch {
    redirect(`/leads/${leadId}/edit?error=Isbeddelka lama kaydin.`);
  }
  redirect(`/leads/${leadId}?message=Lead-ka waa la cusboonaysiiyey.`);
}

export async function updateLeadStatus(formData: FormData) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const leadId = text(formData, "lead_id");
  const status = text(formData, "status");
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect(`/leads/${leadId}?error=Ma lihid oggolaanshaha status-ka.`);
  const allowed = ["new", "qualified", "hot", "viewing", "negotiation", "won", "lost"];
  if (!allowed.includes(status)) redirect(`/leads/${leadId}?error=Status-ku sax ma aha.`);
  const { data: current } = await supabase.from("leads").select("status").eq("id", leadId).eq("agency_id", agency.id).maybeSingle();
  if (!current) redirect("/leads?error=Lead-ka lama helin.");
  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId).eq("agency_id", agency.id);
  if (error) redirect(`/leads/${leadId}?error=Status-ka lama beddeli karin.`);
  await supabase.from("audit_logs").insert({ agency_id: agency.id, user_id: user.id, action: "lead.status_changed", entity_type: "lead", entity_id: leadId, metadata: { from: current.status, to: status } });
  if (status === "hot" && current.status !== "hot") {
    await supabase.from("notifications").insert({ agency_id: agency.id, type: "hot_lead", title: "🔥 Hot lead", body: "Lead ayaa loo beddelay HOT. La xiriir sida ugu dhaqsaha badan.", entity_type: "lead", entity_id: leadId });
  }
  const referer = String(formData.get("return_to") ?? "");
  redirect(referer === "/leads?view=pipeline" ? "/leads?view=pipeline&message=Status-ka waa la beddelay." : `/leads/${leadId}?message=Status-ka waa la beddelay.`);
}

export async function deleteLead(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const leadId = text(formData, "lead_id");
  if (!hasAgencyPermission(membership.role, "delete_leads")) redirect(`/leads/${leadId}?error=Ma lihid oggolaanshaha delete-ka.`);
  const { error } = await supabase.from("leads").delete().eq("id", leadId).eq("agency_id", agency.id);
  if (error) redirect(`/leads/${leadId}?error=Lead-ka lama tirtiri karin.`);
  redirect("/leads?message=Lead-ka waa la tirtiray.");
}

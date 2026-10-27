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

export async function createLead(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect("/leads?error=Ma lihid oggolaanshaha lead cusub.");
  const payload = leadPayload(formData);
  const errorMessage = validateLead(payload);
  if (errorMessage) redirect(`/leads/new?error=${encodeURIComponent(errorMessage)}`);
  const { data: entitlement } = await supabase.rpc("get_agency_plan_entitlement", { target_agency_id: agency.id, resource_name: "leads" });
  if (entitlement?.[0] && !entitlement[0].allowed) redirect("/usage?limit=leads");
  const { data: lead, error } = await supabase.from("leads").insert({ agency_id: agency.id, ...payload }).select("id").single();
  if (error) redirect(error.message.includes("plan_limit_reached") ? "/usage?limit=leads" : "/leads/new?error=Lead-ka lama kaydin. Hubi xogta.");
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
  const { error } = await supabase.from("leads").update(payload).eq("id", leadId).eq("agency_id", agency.id);
  if (error) redirect(`/leads/${leadId}/edit?error=Isbeddelka lama kaydin.`);
  if (current.customer_id) {
    const normalizedPhone = payload.phone?.replace(/\D/g, "") || null;
    await supabase.from("customers").update({ name: payload.name, phone: payload.phone, normalized_phone: normalizedPhone, email: payload.email }).eq("id", current.customer_id).eq("agency_id", agency.id);
  }
  redirect(`/leads/${leadId}?message=Lead-ka waa la cusboonaysiiyey.`);
}

export async function createPropertyTransaction(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const leadId = text(formData, "lead_id");
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect(`/leads/${leadId}?error=Ma lihid oggolaanshaha transaction-ka.`);
  const totalPrice = numberOrNull(formData, "total_price");
  const deposit = numberOrNull(formData, "deposit") ?? 0;
  const transactionType = text(formData, "transaction_type");
  const transactionStatus = text(formData, "transaction_status") || "pending";
  if (!leadId || !["buy", "rent", "reserve", "deposit"].includes(transactionType)) redirect(`/leads/${leadId}?error=Transaction type-ku sax ma aha.`);
  if (totalPrice === null || !Number.isFinite(totalPrice) || totalPrice < 0 || !Number.isFinite(deposit) || deposit < 0 || deposit > totalPrice) redirect(`/leads/${leadId}?error=Qiimaha ama deposit-ku sax ma aha.`);
  if (transactionType === "deposit" && deposit <= 0) redirect(`/leads/${leadId}?error=Deposit transaction-ku wuxuu u baahan yahay lacag deposit ah.`);
  if (!["pending", "completed"].includes(transactionStatus)) redirect(`/leads/${leadId}?error=Transaction status-ku sax ma aha.`);
  const { data, error } = await supabase.rpc("create_property_transaction", {
    target_lead_id: leadId,
    target_property_id: text(formData, "property_id"),
    target_transaction_type: transactionType,
    target_total_price: totalPrice,
    target_deposit: deposit,
    target_transaction_date: text(formData, "transaction_date"),
    target_status: transactionStatus,
    target_assigned_agent_id: text(formData, "assigned_agent_id") || null,
    target_notes: text(formData, "transaction_notes") || null,
  });
  if (error || !data) redirect(`/leads/${leadId}?error=${encodeURIComponent(error?.message || "Transaction-ka lama kaydin.")}`);
  redirect(`/customers/${data}?message=Lead-ka Customer ayaa loo beddelay, transaction-kana waa la kaydiyey.`);
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


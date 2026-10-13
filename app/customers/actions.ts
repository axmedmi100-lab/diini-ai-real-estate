"use server";

import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";

function value(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }
function normalizePhone(phone: string) { return phone.replace(/\D/g, "") || null; }

function customerPayload(formData: FormData) {
  const phone = value(formData, "phone");
  return {
    name: value(formData, "name") || null,
    phone: phone || null,
    normalized_phone: phone ? normalizePhone(phone) : null,
    email: value(formData, "email").toLowerCase() || null,
    preferred_language: value(formData, "preferred_language") === "en" ? "en" : "so",
    notes: value(formData, "notes") || null,
  };
}

export async function updateCustomer(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const customerId = value(formData, "customer_id");
  if (!hasAgencyPermission(membership.role, "manage_crm")) redirect(`/customers/${customerId}?error=Ma lihid oggolaanshaha edit-ka.`);
  const payload = customerPayload(formData);
  if (!customerId || (!payload.name && !payload.phone && !payload.email)) redirect(`/customers/${customerId}?error=Geli magac, phone ama email.`);
  const { error } = await supabase.from("customers").update(payload).eq("id", customerId).eq("agency_id", agency.id);
  if (error) redirect(`/customers/${customerId}?error=${encodeURIComponent(error.code === "23505" ? "Phone-kan customer kale ayuu leeyahay." : "Isbeddelka lama kaydin.")}`);
  redirect(`/customers/${customerId}?message=Customer-ka waa la cusboonaysiiyey.`);
}


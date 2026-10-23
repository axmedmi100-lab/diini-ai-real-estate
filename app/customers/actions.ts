"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

export async function updatePropertyTransaction(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const customerId = value(formData, "customer_id");
  const transactionId = value(formData, "transaction_id");
  if (!new Set(["owner", "admin", "manager", "agent"]).has(membership.role)) redirect(`/customers/${customerId}?error=Ma lihid oggolaanshaha transaction-ka.`);
  const deposit = Number(value(formData, "deposit"));
  const status = value(formData, "status");
  if (!customerId || !transactionId || !Number.isFinite(deposit) || deposit < 0 || !["pending", "completed", "cancelled"].includes(status)) redirect(`/customers/${customerId}?error=Xogta transaction-ka sax ma aha.`);
  const { data: transaction } = await supabase.from("property_transactions").select("id,total_price").eq("id", transactionId).eq("customer_id", customerId).eq("agency_id", agency.id).maybeSingle();
  if (!transaction) redirect(`/customers/${customerId}?error=Transaction-ka lama helin.`);
  const totalPrice = Number(transaction.total_price);
  if (deposit > totalPrice) redirect(`/customers/${customerId}?error=Lacagta la bixiyey kama badnaan karto total-ka.`);
  if (status === "completed" && deposit !== totalPrice) redirect(`/customers/${customerId}?error=Si deal-ka loo dhammeeyo, lacagta la bixiyey waa inay la mid noqotaa total-ka.`);
  const { data: updated, error } = await supabase.from("property_transactions").update({ deposit, status, notes: value(formData, "transaction_notes") || null }).eq("id", transactionId).eq("customer_id", customerId).eq("agency_id", agency.id).select("id,status,deposit,remaining_balance").maybeSingle();
  if (error || !updated) redirect(`/customers/${customerId}?error=Transaction-ka lama cusboonaysiin karin.`);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect(`/customers/${customerId}?message=${status === "completed" ? "Deal-ka waa la dhammeeyey." : "Transaction-ka waa la cusboonaysiiyey."}`);
}


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
  const returnTo = value(formData, "return_to");
  const destination = returnTo === `/transactions/${transactionId}` ? returnTo : `/customers/${customerId}`;
  if (!new Set(["owner", "admin", "manager", "agent"]).has(membership.role)) redirect(`/customers/${customerId}?error=Ma lihid oggolaanshaha transaction-ka.`);
  const status = value(formData, "status");
  if (!customerId || !transactionId || !["pending", "completed", "cancelled"].includes(status)) redirect(`${destination}?error=Xogta transaction-ka sax ma aha.`);
  const { data: transaction } = await supabase.from("property_transactions").select("id,total_price,deposit").eq("id", transactionId).eq("customer_id", customerId).eq("agency_id", agency.id).maybeSingle();
  if (!transaction) redirect(`/customers/${customerId}?error=Transaction-ka lama helin.`);
  const totalPrice = Number(transaction.total_price);
  const paidTotal = Number(transaction.deposit);
  if (status === "completed" && paidTotal !== totalPrice) redirect(`${destination}?error=Si deal-ka loo dhammeeyo, lacagaha la diiwaangeliyey waa inay la mid noqdaan total-ka.`);
  const { data: updated, error } = await supabase.from("property_transactions").update({ status, notes: value(formData, "transaction_notes") || null }).eq("id", transactionId).eq("customer_id", customerId).eq("agency_id", agency.id).select("id,status,deposit,remaining_balance").maybeSingle();
  if (error || !updated) redirect(`/customers/${customerId}?error=Transaction-ka lama cusboonaysiin karin.`);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect(`${destination}?message=${status === "completed" ? "Deal-ka waa la dhammeeyey." : "Transaction-ka waa la cusboonaysiiyey."}`);
}

export async function addTransactionPayment(formData: FormData) {
  const { supabase, membership, agency, user } = await getAgencyWorkspace();
  const transactionId = value(formData, "transaction_id");
  const destination = `/transactions/${transactionId}`;
  if (!new Set(["owner", "admin", "manager", "agent"]).has(membership.role)) redirect(`${destination}?error=Ma lihid oggolaanshaha lacag-bixinta.`);
  const amount = Number(value(formData, "amount"));
  const paymentDate = value(formData, "payment_date");
  const paymentMethod = value(formData, "payment_method");
  if (!transactionId || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || !["cash", "bank_transfer", "mobile_money", "card", "other"].includes(paymentMethod)) redirect(`${destination}?error=Xogta lacag-bixinta sax ma aha.`);
  const { data: transaction } = await supabase.from("property_transactions").select("id,total_price,deposit,status").eq("id", transactionId).eq("agency_id", agency.id).maybeSingle();
  if (!transaction) redirect(`${destination}?error=Transaction-ka lama helin.`);
  if (transaction.status === "cancelled") redirect(`${destination}?error=Transaction cancelled ah lacag laguma dari karo.`);
  const remaining = Number(transaction.total_price) - Number(transaction.deposit);
  if (amount > remaining) redirect(`${destination}?error=Lacagtu kama badnaan karto remaining-ka ${remaining.toLocaleString()}.`);
  const { error } = await supabase.from("transaction_payments").insert({ agency_id: agency.id, transaction_id: transactionId, amount, payment_date: paymentDate, payment_method: paymentMethod, reference: value(formData, "reference") || null, notes: value(formData, "payment_notes") || null, created_by: user.id });
  if (error) redirect(`${destination}?error=Lacag-bixinta lama kaydin karin.`);
  revalidatePath(destination);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect(`${destination}?message=Lacag-bixinta waa la diiwaangeliyey.`);
}


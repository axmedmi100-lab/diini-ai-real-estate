"use server";

import { redirect } from "next/navigation";

import { stripePost } from "@/lib/billing/stripe";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export async function submitManualPayment(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (membership.role !== "owner") redirect("/billing?error=Kaliya owner-ka ayaa codsi lacag-bixin diri kara.");
  const planCode = String(formData.get("plan_code") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethod = String(formData.get("payment_method") ?? "");
  const paymentReference = String(formData.get("payment_reference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const { error } = await supabase.rpc("create_manual_payment_request", {
    target_plan_code: planCode,
    target_amount: amount,
    target_currency: agency.default_currency.toLowerCase(),
    target_payment_method: paymentMethod,
    target_payment_reference: paymentReference,
    target_notes: notes || null,
  });
  if (error) redirect(`/billing?error=${encodeURIComponent(error.message.includes("pending") ? "Codsi kale ayaa wali sugaya ansixin." : "Codsiga lacag-bixinta lama dirin. Hubi xogta.")}`);
  redirect("/billing?manual=1");
}

export async function startPlanCheckout(formData: FormData) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  if (membership.role !== "owner") redirect("/billing?error=Kaliya owner-ka ayaa plan beddeli kara.");
  const planCode = String(formData.get("plan_code") ?? "");
  const { data: plan } = await supabase.from("platform_plans").select("code,stripe_price_id,is_active").eq("code", planCode).eq("is_active", true).maybeSingle();
  if (!plan?.stripe_price_id || plan.code === agency.plan_code) redirect("/billing?error=Plan-kan checkout uma diyaarsana ama hadda ayaad ku jirtaa.");
  const { data: existing } = await supabase.from("agency_subscriptions").select("provider_customer_id").eq("agency_id", agency.id).maybeSingle();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const session = await stripePost<{ url: string }>("/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": plan.stripe_price_id,
    "line_items[0][quantity]": "1",
    success_url: `${siteUrl}/billing?success=1`,
    cancel_url: `${siteUrl}/billing?canceled=1`,
    client_reference_id: agency.id,
    customer: existing?.provider_customer_id || undefined,
    customer_email: existing?.provider_customer_id ? undefined : user.email,
    "metadata[agency_id]": agency.id,
    "metadata[plan_code]": plan.code,
    "subscription_data[metadata][agency_id]": agency.id,
    "subscription_data[metadata][plan_code]": plan.code,
  });
  redirect(session.url);
}

export async function openBillingPortal() {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (membership.role !== "owner") redirect("/billing?error=Kaliya owner-ka ayaa billing maamuli kara.");
  const { data: subscription } = await supabase.from("agency_subscriptions").select("provider_customer_id").eq("agency_id", agency.id).maybeSingle();
  if (!subscription?.provider_customer_id) redirect("/billing?error=Stripe customer wali lama samayn.");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const portal = await stripePost<{ url: string }>("/billing_portal/sessions", { customer: subscription.provider_customer_id, return_url: `${siteUrl}/billing` });
  redirect(portal.url);
}


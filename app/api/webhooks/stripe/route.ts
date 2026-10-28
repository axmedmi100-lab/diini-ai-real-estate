import { NextResponse } from "next/server";

import { verifyStripeSignature } from "@/lib/billing/stripe";
import { logServerEvent, requestId } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";

type StripeObject = Record<string, unknown> & { id?: string; status?: string; customer?: string; subscription?: string; metadata?: { agency_id?: string; plan_code?: string } };
type StripeEvent = { id: string; type: string; data: { object: StripeObject } };

function text(value: unknown) { return typeof value === "string" ? value : null; }
function timestamp(value: unknown) { return typeof value === "number" ? new Date(value * 1000).toISOString() : null; }

export async function POST(request: Request) {
  const id = requestId(request);
  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"))) return new NextResponse("Invalid signature", { status: 400 });
  let event: StripeEvent;
  try { event = JSON.parse(rawBody) as StripeEvent; } catch { return new NextResponse("Invalid JSON", { status: 400 }); }
  if (!event.id || !event.type || !event.data?.object) return new NextResponse("Invalid event", { status: 400 });
  const supabase = createAdminClient();
  const { error: eventError } = await supabase.from("billing_webhook_events").insert({ provider_event_id: event.id, event_type: event.type });
  if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (eventError) return new NextResponse("Event persistence failed", { status: 500 });

  const object = event.data.object;
  try {
    if (event.type === "checkout.session.completed") {
      const agencyId = object.metadata?.agency_id || text(object.client_reference_id);
      const planCode = object.metadata?.plan_code;
      if (agencyId && planCode) await supabase.from("agency_subscriptions").upsert({ agency_id: agencyId, provider_customer_id: text(object.customer), provider_subscription_id: text(object.subscription), plan_code: planCode, status: "incomplete" }, { onConflict: "agency_id" });
    }

    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const agencyId = object.metadata?.agency_id;
      const planCode = object.metadata?.plan_code;
      if (agencyId && planCode && object.id) {
        const status = event.type === "customer.subscription.deleted" ? "canceled" : (object.status || "incomplete");
        await supabase.from("agency_subscriptions").upsert({ agency_id: agencyId, provider_customer_id: text(object.customer), provider_subscription_id: object.id, plan_code: planCode, status, current_period_end: timestamp(object.current_period_end), cancel_at_period_end: object.cancel_at_period_end === true }, { onConflict: "agency_id" });
        if (["active", "trialing"].includes(status)) await supabase.from("agencies").update({ plan_code: planCode, lifecycle_status: "active" }).eq("id", agencyId);
        if (status === "canceled") await supabase.from("agencies").update({ plan_code: "starter" }).eq("id", agencyId);
      }
    }

    if (["invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed"].includes(event.type) && object.id) {
      const subscriptionId = text(object.subscription) || text((object.parent as { subscription_details?: { subscription?: string } } | undefined)?.subscription_details?.subscription);
      const { data: subscription } = subscriptionId
        ? await supabase.from("agency_subscriptions").select("agency_id").eq("provider_subscription_id", subscriptionId).maybeSingle()
        : await supabase.from("agency_subscriptions").select("agency_id").eq("provider_customer_id", text(object.customer)).maybeSingle();
      if (subscription?.agency_id) {
        const paid = event.type !== "invoice.payment_failed";
        await supabase.from("billing_invoices").upsert({ agency_id: subscription.agency_id, provider_invoice_id: object.id, provider_subscription_id: subscriptionId, status: object.status || (paid ? "paid" : "open"), currency: text(object.currency) || "usd", amount_due: Number(object.amount_due || 0) / 100, amount_paid: Number(object.amount_paid || 0) / 100, hosted_invoice_url: text(object.hosted_invoice_url), invoice_pdf_url: text(object.invoice_pdf), period_start: timestamp(object.period_start), period_end: timestamp(object.period_end), paid_at: paid ? new Date().toISOString() : null }, { onConflict: "provider_invoice_id" });
        if (!paid) {
          await supabase.from("agency_subscriptions").update({ status: "past_due" }).eq("agency_id", subscription.agency_id);
          await supabase.from("notifications").insert({ agency_id: subscription.agency_id, type: "payment_failed", title: "Subscription payment failed", body: "Lacag-bixinta plan-ka way fashilantay. Billing portal-ka ka cusboonaysii payment method-ka.", entity_type: "billing_invoice", entity_id: null });
        }
      }
    }
  } catch (error) {
    logServerEvent("error", "stripe.webhook_processing_failed", { requestId: id, eventId: event.id, eventType: event.type, error: error instanceof Error ? error.message : "unknown" });
    await supabase.from("billing_webhook_events").delete().eq("provider_event_id", event.id);
    return new NextResponse("Webhook processing failed", { status: 500 });
  }
  return NextResponse.json({ received: true });
}


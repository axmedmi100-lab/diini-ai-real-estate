import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { createBillingInvoicePdf } from "@/lib/pdf/billing-invoice";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, agency } = await getAgencyWorkspace();
  const { data: invoice } = await supabase.from("billing_invoices").select("id,provider_invoice_id,status,currency,amount_due,amount_paid,period_start,period_end,paid_at").eq("id", id).eq("agency_id", agency.id).maybeSingle();
  if (!invoice) return new Response("Invoice not found", { status: 404 });
  if (!invoice.provider_invoice_id.startsWith("manual:")) return new Response("Manual invoice required", { status: 400 });
  const requestId = invoice.provider_invoice_id.slice("manual:".length);
  const { data: payment } = await supabase.from("manual_payment_requests").select("plan_code,payment_method,payment_reference").eq("id", requestId).eq("agency_id", agency.id).eq("status", "approved").maybeSingle();
  if (!payment) return new Response("Approved payment not found", { status: 404 });
  const bytes = await createBillingInvoicePdf({
    agencyName: agency.name,
    invoiceId: invoice.id,
    planCode: payment.plan_code,
    status: invoice.status,
    currency: invoice.currency,
    amount: Number(invoice.amount_paid || invoice.amount_due),
    paymentMethod: payment.payment_method,
    paymentReference: payment.payment_reference,
    paidAt: invoice.paid_at,
    periodStart: invoice.period_start,
    periodEnd: invoice.period_end,
  });
  const inline = new URL(request.url).searchParams.get("view") === "1";
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="subscription-invoice-${id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" } });
}


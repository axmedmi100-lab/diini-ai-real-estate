import { createTransactionPdf } from "@/lib/pdf/transaction-document";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

type Related = { name?: string | null; phone?: string | null; title?: string | null; currency?: string | null };
const one = (value: Related | Related[] | null) => Array.isArray(value) ? value[0] ?? null : value;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paymentId = new URL(request.url).searchParams.get("payment");
  const { supabase, agency } = await getAgencyWorkspace();
  const [{ data: transaction }, { data: payments }] = await Promise.all([
    supabase.from("property_transactions").select("id,customer_id,property_id,transaction_type,total_price,deposit,remaining_balance,transaction_date,status,customers(name,phone),properties(title,currency)").eq("id", id).eq("agency_id", agency.id).maybeSingle(),
    supabase.from("transaction_payments").select("id,amount,payment_date,payment_method,reference,notes").eq("transaction_id", id).eq("agency_id", agency.id).order("payment_date", { ascending: false }),
  ]);
  if (!transaction) return new Response("Transaction not found", { status: 404 });
  if (paymentId && !(payments ?? []).some((item) => item.id === paymentId)) return new Response("Payment not found", { status: 404 });
  const customer = one(transaction.customers as Related | Related[] | null);
  const property = one(transaction.properties as Related | Related[] | null);
  const bytes = await createTransactionPdf({
    agencyName: agency.name,
    customerName: customer?.name || customer?.phone || "Customer",
    customerPhone: customer?.phone,
    propertyTitle: property?.title || "Property",
    currency: property?.currency || "USD",
    transactionId: transaction.id,
    transactionDate: transaction.transaction_date,
    transactionType: transaction.transaction_type,
    status: transaction.status,
    total: Number(transaction.total_price),
    paid: Number(transaction.deposit),
    remaining: Number(transaction.remaining_balance),
    payments: (payments ?? []).map((item) => ({ id: item.id, amount: Number(item.amount), paymentDate: item.payment_date, paymentMethod: item.payment_method, reference: item.reference, notes: item.notes })),
    receiptPaymentId: paymentId,
  });
  const filename = paymentId ? `payment-receipt-${paymentId.slice(0, 8)}.pdf` : `transaction-invoice-${id.slice(0, 8)}.pdf`;
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}


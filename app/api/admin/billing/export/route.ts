import { getPlatformAdmin } from "@/lib/platform-admin";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET() {
  const { supabase } = await getPlatformAdmin();
  const { data: invoices, error } = await supabase.from("billing_invoices").select("id,provider_invoice_id,status,currency,amount_due,amount_paid,period_start,period_end,paid_at,created_at,agencies(name)").order("created_at", { ascending: false });
  if (error) return new Response("Export failed", { status: 500 });
  const header = ["invoice_id","agency","provider_invoice_id","status","currency","amount_due","amount_paid","period_start","period_end","paid_at","created_at"];
  const rows = (invoices ?? []).map((invoice) => {
    const relation = invoice.agencies as unknown as {name?: string} | {name?: string}[] | null;
    const agency = Array.isArray(relation) ? relation[0]?.name : relation?.name;
    return [invoice.id,agency,invoice.provider_invoice_id,invoice.status,invoice.currency,invoice.amount_due,invoice.amount_paid,invoice.period_start,invoice.period_end,invoice.paid_at,invoice.created_at].map(csv).join(",");
  });
  return new Response([header.map(csv).join(","),...rows].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="diini-revenue-${new Date().toISOString().slice(0,10)}.csv"`, "Cache-Control": "private, no-store" } });
}


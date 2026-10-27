import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { createLeaseAgreementPdf } from "@/lib/pdf/transaction-document";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, agency } = await getAgencyWorkspace();
  const { data: lease } = await supabase.from("property_occupancy_records").select("id,customer_id,property_id,record_type,start_date,end_date,monthly_rent,security_deposit,lease_notes").eq("id", id).eq("agency_id", agency.id).maybeSingle();
  if (!lease || lease.record_type !== "tenancy") return new Response("Lease not found", { status: 404 });
  const [{ data: customer }, { data: property }] = await Promise.all([
    supabase.from("customers").select("name,phone").eq("id", lease.customer_id).eq("agency_id", agency.id).maybeSingle(),
    supabase.from("properties").select("title,address,district,currency,price").eq("id", lease.property_id).eq("agency_id", agency.id).maybeSingle(),
  ]);
  if (!customer || !property) return new Response("Lease parties not found", { status: 404 });
  const bytes = await createLeaseAgreementPdf({ agencyName: agency.name, propertyTitle: property.title, propertyAddress: property.address || property.district, tenantName: customer.name || customer.phone || "Tenant", tenantPhone: customer.phone, currency: property.currency || "USD", startDate: lease.start_date, endDate: lease.end_date, monthlyRent: Number(lease.monthly_rent ?? property.price), securityDeposit: Number(lease.security_deposit ?? 0), notes: lease.lease_notes });
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="lease-agreement-${id.slice(0,8)}.pdf"`, "Cache-Control": "private, no-store" } });
}


"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";

const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function updateLease(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const propertyId = value(formData, "property_id");
  const occupancyId = value(formData, "occupancy_id");
  const destination = `/properties/${propertyId}`;
  if (!new Set(["owner", "admin", "manager", "agent"]).has(membership.role)) redirect(`${destination}?error=Ma lihid oggolaanshaha lease-ka.`);
  const endDate = value(formData, "end_date");
  const monthlyRent = Number(value(formData, "monthly_rent"));
  const securityDeposit = Number(value(formData, "security_deposit") || "0");
  const { data: lease } = await supabase.from("property_occupancy_records").select("id,start_date,record_type,status").eq("id", occupancyId).eq("property_id", propertyId).eq("agency_id", agency.id).maybeSingle();
  if (!lease || lease.record_type !== "tenancy") redirect(`${destination}?error=Tenancy record lama helin.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < lease.start_date || !Number.isFinite(monthlyRent) || monthlyRent < 0 || !Number.isFinite(securityDeposit) || securityDeposit < 0) redirect(`${destination}?error=Lease terms-ka sax ma aha.`);
  const { error } = await supabase.from("property_occupancy_records").update({ end_date: endDate, monthly_rent: monthlyRent, security_deposit: securityDeposit, lease_notes: value(formData, "lease_notes") || null, status: "active" }).eq("id", occupancyId).eq("agency_id", agency.id);
  if (error) redirect(`${destination}?error=Lease-ka lama kaydin karin.`);
  revalidatePath(destination);
  redirect(`${destination}?message=Lease terms waa la kaydiyey; reminders-ka waa la jadwaleeyey.`);
}

export async function endLease(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const propertyId = value(formData, "property_id");
  const occupancyId = value(formData, "occupancy_id");
  const destination = `/properties/${propertyId}`;
  if (!new Set(["owner", "admin", "manager"]).has(membership.role)) redirect(`${destination}?error=Owner, admin ama manager ayaa lease joojin kara.`);
  const endDate = value(formData, "actual_end_date") || new Date().toISOString().slice(0,10);
  const { data: ended, error } = await supabase.from("property_occupancy_records").update({ status: "ended", end_date: endDate }).eq("id", occupancyId).eq("property_id", propertyId).eq("agency_id", agency.id).eq("record_type", "tenancy").select("id").maybeSingle();
  if (error || !ended) redirect(`${destination}?error=Lease-ka lama joojin karin.`);
  await supabase.from("properties").update({ status: "available", available_from: endDate }).eq("id", propertyId).eq("agency_id", agency.id);
  revalidatePath(destination);
  revalidatePath("/properties");
  redirect(`${destination}?message=Lease-ka waa la joojiyey; property-gu Available ayuu noqday.`);
}


import Link from "next/link";
import { notFound } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { updateProperty } from "@/app/properties/actions";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { PropertyForm } from "@/components/properties/property-form";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function EditPropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  if (!["owner", "admin", "manager", "agent"].includes(membership.role)) return null;
  const { data: property } = await supabase.from("properties").select("*").eq("id", id).eq("agency_id", agency.id).maybeSingle();
  if (!property) notFound();
  return <AppShell agencyName={agency.name} currentPath="/properties" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-4xl space-y-8"><PageHeading eyebrow="Property CRUD" title="Wax ka beddel property-ga" description="Cusboonaysii listing-ka iyo xaaladdiisa." action={<Link className="text-sm font-bold text-slate-600" href={`/properties/${id}`}>← Faahfaahinta</Link>} /><PropertyForm action={updateProperty} error={error} property={property} /></div></AppShell>;
}

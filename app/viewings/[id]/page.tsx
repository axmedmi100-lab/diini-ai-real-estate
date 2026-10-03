import Link from "next/link";
import { notFound } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { updateViewing } from "@/app/viewings/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ViewingForm } from "@/components/viewings/viewing-form";
import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { getAssignableAgents } from "@/lib/lead-agents";

export default async function ViewingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { id } = await params; const notice = await searchParams;
  const { supabase, user, agency } = await getAgencyWorkspace();
  const [{ data: viewing }, agents] = await Promise.all([supabase.from("viewings").select("*").eq("id", id).eq("agency_id", agency.id).maybeSingle(), getAssignableAgents(supabase, agency.id)]);
  if (!viewing) notFound();
  const [{ data: lead }, { data: property }] = await Promise.all([supabase.from("leads").select("id, name, phone").eq("id", viewing.lead_id).eq("agency_id", agency.id).single(), supabase.from("properties").select("id, title, district").eq("id", viewing.property_id).eq("agency_id", agency.id).single()]);
  if (!lead || !property) notFound();
  return <AppShell agencyName={agency.name} currentPath="/viewings" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-4xl space-y-6"><Link className="text-sm font-bold text-slate-600" href="/viewings">← Viewings</Link><div><p className="text-xs font-bold tracking-wide text-emerald-700 uppercase">{notice.message || viewing.status}</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{lead?.name || lead?.phone || "Viewing"}</h1><p className="mt-2 text-sm text-slate-500">{property?.title} · {property?.district}</p></div><ViewingForm action={updateViewing} agents={agents} error={notice.error} leads={[{ id: lead.id, label: lead.name || lead.phone || "Lead" }]} properties={[{ id: property.id, label: `${property.title} · ${property.district}` }]} viewing={viewing} /></div></AppShell>;
}

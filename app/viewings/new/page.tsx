import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { createViewing } from "@/app/viewings/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ViewingForm } from "@/components/viewings/viewing-form";
import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { getAssignableAgents } from "@/lib/lead-agents";

export default async function NewViewingPage({ searchParams }: { searchParams: Promise<{ error?: string; lead?: string; property?: string }> }) {
  const params = await searchParams;
  const { supabase, user, agency } = await getAgencyWorkspace();
  const [{ data: leads }, { data: properties }, agents] = await Promise.all([
    supabase.from("leads").select("id, name, phone").eq("agency_id", agency.id).not("status", "in", "(won,lost)").order("created_at", { ascending: false }),
    supabase.from("properties").select("id, title, district").eq("agency_id", agency.id).eq("status", "available").order("title"),
    getAssignableAgents(supabase, agency.id),
  ]);
  return <AppShell agencyName={agency.name} currentPath="/viewings" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-4xl space-y-6"><Link className="text-sm font-bold text-slate-600" href="/viewings">← Viewings</Link><div><p className="text-xs font-bold tracking-wide text-emerald-700 uppercase">Appointment</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Viewing cusub</h1></div><ViewingForm action={createViewing} agents={agents} error={params.error} leads={(leads ?? []).map((item) => ({ id: item.id, label: item.name || item.phone || "Lead aan magac lahayn" }))} properties={(properties ?? []).map((item) => ({ id: item.id, label: `${item.title} · ${item.district}` }))} viewing={{ lead_id: params.lead, property_id: params.property }} /></div></AppShell>;
}

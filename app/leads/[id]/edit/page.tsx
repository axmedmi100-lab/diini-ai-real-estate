import Link from "next/link";
import { notFound } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { updateLead } from "@/app/leads/actions";
import { PageHeading } from "@/components/dashboard/page-heading";
import { LeadForm } from "@/components/leads/lead-form";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { getAssignableAgents } from "@/lib/lead-agents";

export default async function EditLeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  if (!["owner", "admin", "manager", "agent", "receptionist"].includes(membership.role)) return null;
  const [{ data: lead }, agents] = await Promise.all([supabase.from("leads").select("*").eq("id", id).eq("agency_id", agency.id).maybeSingle(), getAssignableAgents(supabase, agency.id)]);
  if (!lead) notFound();
  return <AppShell agencyName={agency.name} currentPath="/leads" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-4xl space-y-8"><PageHeading eyebrow="Lead CRM" title="Wax ka beddel lead-ka" description="Cusboonaysii requirements-ka, status-ka iyo agent-ka." action={<Link className="text-sm font-bold text-slate-600" href={`/leads/${id}`}>← Faahfaahinta</Link>} /><LeadForm action={updateLead} agents={agents} error={error} lead={lead} /></div></AppShell>;
}

import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { createLead } from "@/app/leads/actions";
import { PageHeading } from "@/components/dashboard/page-heading";
import { LeadForm } from "@/components/leads/lead-form";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { getAssignableAgents } from "@/lib/lead-agents";

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const { error } = await searchParams;
  if (!["owner", "admin", "manager", "agent", "receptionist"].includes(membership.role)) return null;
  const agents = await getAssignableAgents(supabase, agency.id);
  return <AppShell agencyName={agency.name} currentPath="/leads" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-4xl space-y-8"><PageHeading eyebrow="Lead CRM" title="Lead cusub" description="Diiwaangeli xiriirka qofka iyo property-ga uu raadinayo." action={<Link className="text-sm font-bold text-slate-600" href="/leads">← Dib u noqo</Link>} /><LeadForm action={createLead} agents={agents} error={error} /></div></AppShell>;
}

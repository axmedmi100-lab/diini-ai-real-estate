import Link from "next/link";
import { notFound } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { deleteLead, updateLeadStatus } from "@/app/leads/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { AppShell } from "@/components/layout/app-shell";
import { DeleteLeadButton } from "@/components/leads/delete-lead-button";
import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { getAssignableAgents } from "@/lib/lead-agents";

const statuses = ["new", "qualified", "hot", "viewing", "negotiation", "won", "lost"];

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { id } = await params;
  const messages = await searchParams;
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const [{ data: lead }, agents] = await Promise.all([supabase.from("leads").select("*").eq("id", id).eq("agency_id", agency.id).maybeSingle(), getAssignableAgents(supabase, agency.id)]);
  if (!lead) notFound();
  const assigned = agents.find((agent) => agent.id === lead.assigned_agent_id);
  const canEdit = ["owner", "admin", "manager", "agent", "receptionist"].includes(membership.role);
  const canDelete = ["owner", "admin", "manager"].includes(membership.role);
  const budget = lead.budget_min || lead.budget_max ? `$${Number(lead.budget_min ?? 0).toLocaleString()} – $${Number(lead.budget_max ?? 0).toLocaleString()}` : "Lama cayimin";

  return (
    <AppShell agencyName={agency.name} currentPath="/leads" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link className="text-sm font-bold text-slate-600" href="/leads">← Leads</Link><div className="flex items-center gap-2">{canEdit ? <Link className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" href={`/leads/${id}/edit`}>Edit</Link> : null}{canDelete ? <DeleteLeadButton action={deleteLead} leadId={id} /> : null}</div></div>
        <AuthMessage error={messages.error} message={messages.message} />
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-wide text-emerald-700 uppercase">{lead.source} lead</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{lead.name || "Lead aan magac lahayn"}</h1><p className="mt-2 text-sm text-slate-500">{lead.phone || "Phone ma jiro"} · {lead.email || "Email ma jiro"}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold capitalize text-emerald-800">{lead.status}</span></div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">{[["Purpose", lead.purpose || "—"], ["District", lead.district || "—"], ["Property type", lead.property_type || "—"], ["Bedrooms", lead.bedrooms ?? "—"], ["Budget", budget], ["Furnished", lead.furnished === null ? "Mid kasta" : lead.furnished ? "Haa" : "Maya"]].map(([label, value]) => <div className="rounded-2xl bg-slate-50 p-4" key={String(label)}><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-bold capitalize text-slate-950">{value}</p></div>)}</div>
            <div className="mt-8"><h2 className="font-bold text-slate-950">Notes</h2><p className="mt-3 whitespace-pre-line rounded-2xl border border-slate-200 p-4 text-sm leading-7 text-slate-600">{lead.notes || "Weli notes lama gelin."}</p></div>
          </div>
          <aside className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-slate-950">Pipeline status</h2><p className="mt-2 text-sm text-slate-500">U dhaqaaji lead-ka marxaladda xigta.</p>{canEdit ? <form action={updateLeadStatus} className="mt-5"><input name="lead_id" type="hidden" value={id} /><select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm capitalize" defaultValue={lead.status} name="status">{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950" type="submit">Beddel status-ka</button></form> : null}</div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold tracking-wide text-slate-400 uppercase">Assigned agent</p><p className="mt-2 font-bold text-slate-950">{assigned?.label || "Weli lama xilsaarin"}</p>{assigned ? <p className="mt-1 text-xs capitalize text-slate-500">{assigned.role}</p> : null}</div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

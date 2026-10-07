import Link from "next/link";
import { notFound } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { deleteLead, updateLeadStatus } from "@/app/leads/actions";
import { prepareMatchOutreach } from "@/app/matches/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { AppShell } from "@/components/layout/app-shell";
import { DeleteLeadButton } from "@/components/leads/delete-lead-button";
import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { getAssignableAgents } from "@/lib/lead-agents";
import { rankProperties } from "@/lib/matching/property-matcher";

const statuses = ["new", "qualified", "hot", "viewing", "negotiation", "won", "lost"];

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { id } = await params;
  const messages = await searchParams;
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const [{ data: lead }, agents, { data: properties }] = await Promise.all([supabase.from("leads").select("*").eq("id", id).eq("agency_id", agency.id).maybeSingle(), getAssignableAgents(supabase, agency.id), supabase.from("properties").select("id,title,purpose,status,district,price,currency,bedrooms,property_type,furnished").eq("agency_id", agency.id).eq("status", "available")]);
  if (!lead) notFound();
  const assigned = agents.find((agent) => agent.id === lead.assigned_agent_id);
  const canEdit = ["owner", "admin", "manager", "agent", "receptionist"].includes(membership.role);
  const canDelete = ["owner", "admin", "manager"].includes(membership.role);
  const budget = lead.budget_min || lead.budget_max ? `$${Number(lead.budget_min ?? 0).toLocaleString()} – $${Number(lead.budget_max ?? 0).toLocaleString()}` : "Lama cayimin";
  const matches = rankProperties({ purpose: lead.purpose, district: lead.district, budget_min: lead.budget_min === null ? null : Number(lead.budget_min), budget_max: lead.budget_max === null ? null : Number(lead.budget_max), bedrooms: lead.bedrooms, property_type: lead.property_type, furnished: lead.furnished }, (properties ?? []).map((property) => ({ ...property, price: Number(property.price) }))).slice(0, 5);

  return (
    <AppShell agencyName={agency.name} currentPath="/leads" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link className="text-sm font-bold text-slate-600" href="/leads">← Leads</Link><div className="flex items-center gap-2">{canEdit ? <Link className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" href={`/leads/${id}/edit`}>Edit</Link> : null}{canDelete ? <DeleteLeadButton action={deleteLead} leadId={id} /> : null}</div></div>
        <AuthMessage error={messages.error} message={messages.message} />
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-wide text-emerald-700 uppercase">{lead.source} lead</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{lead.name || "Lead aan magac lahayn"}</h1><p className="mt-2 text-sm text-slate-500">{lead.phone || "Phone ma jiro"} · {lead.email || "Email ma jiro"}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold capitalize text-emerald-800">{lead.status}</span></div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">{[["Purpose", lead.purpose || "—"], ["District", lead.district || "—"], ["Property type", lead.property_type || "—"], ["Bedrooms", lead.bedrooms ?? "—"], ["Budget", budget], ["Furnished", lead.furnished === null ? "Mid kasta" : lead.furnished ? "Haa" : "Maya"], ["Timeline", lead.timeline || "—"]].map(([label, value]) => <div className="rounded-2xl bg-slate-50 p-4" key={String(label)}><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-bold capitalize text-slate-950">{value}</p></div>)}</div>
            <div className="mt-8"><h2 className="font-bold text-slate-950">Notes</h2><p className="mt-3 whitespace-pre-line rounded-2xl border border-slate-200 p-4 text-sm leading-7 text-slate-600">{lead.notes || "Weli notes lama gelin."}</p></div>
          </div>
          <aside className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-slate-950">Pipeline status</h2><p className="mt-2 text-sm text-slate-500">U dhaqaaji lead-ka marxaladda xigta.</p>{canEdit ? <form action={updateLeadStatus} className="mt-5"><input name="lead_id" type="hidden" value={id} /><select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm capitalize" defaultValue={lead.status} name="status">{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950" type="submit">Beddel status-ka</button></form> : null}</div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold tracking-wide text-slate-400 uppercase">Assigned agent</p><p className="mt-2 font-bold text-slate-950">{assigned?.label || "Weli lama xilsaarin"}</p>{assigned ? <p className="mt-1 text-xs capitalize text-slate-500">{assigned.role}</p> : null}</div>
          </aside>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div><p className="text-xs font-bold tracking-wide text-emerald-700 uppercase">Deterministic matching</p><h2 className="mt-2 text-2xl font-black text-slate-950">Property-ga ugu habboon</h2><p className="mt-2 text-sm text-slate-500">Boqolleyda waxaa xisaabiya engine-ka iyadoo property availability iyo purpose ay yihiin hard filters.</p></div><div className="mt-6 grid gap-4">{matches.length ? matches.map(({ property, score, reasons }) => <article className="rounded-2xl border border-slate-200 p-5" key={property.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><Link className="text-lg font-black text-slate-950 hover:text-emerald-700" href={`/properties/${property.id}`}>{property.title}</Link><p className="mt-1 text-sm text-slate-500">{property.district} · ${Number(property.price).toLocaleString()} · {property.bedrooms ?? "—"} BR</p></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-black text-emerald-800">{score}% Match</span></div><div className="mt-4 flex flex-wrap gap-2">{reasons.map((reason) => <span className={`rounded-full px-3 py-1 text-xs font-bold ${reason.matched ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`} key={reason.key}>{reason.matched ? "✓" : "×"} {reason.label}</span>)}</div><div className="mt-4 flex gap-2"><form action={prepareMatchOutreach}><input name="lead_id" type="hidden" value={id} /><input name="property_id" type="hidden" value={property.id} /><input name="score" type="hidden" value={score} /><input name="return_to" type="hidden" value={`/leads/${id}`} /><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Diyaari outreach</button></form><Link className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700" href={`/viewings/new?lead=${id}&property=${property.id}`}>Book viewing</Link></div></article>) : <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Property available ah oo purpose-kan la jaanqaadaya lama helin. Requirement-ku wuu kaydsan yahay.</p>}</div></section>
      </div>
    </AppShell>
  );
}

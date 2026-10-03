import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function DashboardPage() {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const [properties, leads, members, viewings, recentLeads] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("agency_id", agency.id),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("agency_id", agency.id),
    supabase.from("agency_members").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).eq("is_active", true),
    supabase.from("viewings").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).gte("starts_at", new Date().toISOString()),
    supabase.from("leads").select("id, name, phone, source, status, created_at").eq("agency_id", agency.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const stats = [
    { label: "Properties", value: properties.count ?? 0, detail: "Dhammaan listings", href: "/properties", accent: "bg-emerald-100 text-emerald-800" },
    { label: "Leads", value: leads.count ?? 0, detail: "Fursadaha iibka", href: "/leads", accent: "bg-sky-100 text-sky-800" },
    { label: "Agents", value: members.count ?? 0, detail: "Team-ka firfircoon", href: "/agents", accent: "bg-violet-100 text-violet-800" },
    { label: "Viewings", value: viewings.count ?? 0, detail: "Kuwa soo socda", href: "/dashboard", accent: "bg-amber-100 text-amber-800" },
  ];

  return (
    <AppShell agencyName={agency.name} currentPath="/dashboard" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeading eyebrow="Agency overview" title={`Ku soo dhowow, ${agency.name}`} description="La soco properties-ka, leads-ka iyo hawlaha team-kaaga hal dashboard oo ammaan ah." action={<span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold capitalize text-emerald-800">{membership.role}</span>} />
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => <Link className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href={stat.href} key={stat.label}><div className={`inline-flex rounded-xl px-2.5 py-1 text-xs font-bold ${stat.accent}`}>{stat.label}</div><p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{stat.value}</p><p className="mt-1 text-sm text-slate-500">{stat.detail}</p></Link>)}
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-950">Leads-kii ugu dambeeyey</h2><p className="mt-1 text-sm text-slate-500">Xiriirrada cusub ee agency-ga.</p></div><Link className="text-sm font-bold text-emerald-700" href="/leads">Dhammaan eeg →</Link></div>
            <div className="mt-5">{recentLeads.data?.length ? <div className="divide-y divide-slate-100">{recentLeads.data.map((lead) => <div className="flex items-center justify-between gap-4 py-4" key={lead.id}><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{lead.name || lead.phone || "Lead aan magac lahayn"}</p><p className="mt-1 text-xs capitalize text-slate-500">{lead.source} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(lead.created_at))}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-600">{lead.status}</span></div>)}</div> : <EmptyState title="Weli lead ma jiro" description="Leads-ka cusub waxay halkan kasoo muuqan doonaan marka la diiwaangeliyo." />}</div>
          </div>
          <aside className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-bold tracking-[0.18em] text-emerald-400 uppercase">Workspace health</p><h2 className="mt-3 text-2xl font-bold">Aasaaska waa diyaar.</h2><p className="mt-3 text-sm leading-6 text-slate-300">Authentication, tenant isolation iyo agency workspace-kaagu dhammaantood way shaqaynayaan.</p>
            <div className="mt-6 space-y-3">{["Supabase Auth connected", "RLS tenant security", "Agency profile active"].map((item) => <div className="flex items-center gap-3 text-sm" key={item}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-slate-950">✓</span>{item}</div>)}</div>
            <Link className="mt-7 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950" href="/settings">Agency settings</Link>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

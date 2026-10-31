import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function DashboardPage() {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const [properties, leads, members, viewings, recentLeads, transactions, wonLeads] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("agency_id", agency.id),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("agency_id", agency.id),
    supabase.from("agency_members").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).eq("is_active", true),
    supabase.from("viewings").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).gte("starts_at", new Date().toISOString()),
    supabase.from("leads").select("id, name, phone, source, status, created_at").eq("agency_id", agency.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("property_transactions").select("total_price,deposit,remaining_balance,status").eq("agency_id", agency.id),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).eq("status", "won"),
  ]);
  const finance = (transactions.data ?? []).reduce((sum, item) => ({ completedDeals: sum.completedDeals + (item.status === "completed" ? 1 : 0), revenue: sum.revenue + (item.status === "completed" ? Number(item.total_price) : 0), deposits: sum.deposits + (item.status !== "cancelled" ? Number(item.deposit) : 0), remaining: sum.remaining + (item.status === "pending" ? Number(item.remaining_balance) : 0) }), { completedDeals: 0, revenue: 0, deposits: 0, remaining: 0 });
  const conversionRate = leads.count ? Math.round(((wonLeads.count ?? 0) / leads.count) * 100) : 0;
  const stats = [
    { label: "Properties", value: properties.count ?? 0, detail: "Dhammaan listings", href: "/properties", accent: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    { label: "Leads", value: leads.count ?? 0, detail: "Fursadaha iibka", href: "/leads", accent: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
    { label: "Agents", value: members.count ?? 0, detail: "Team-ka firfircoon", href: "/agents", accent: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
    { label: "Viewings", value: viewings.count ?? 0, detail: "Kuwa soo socda", href: "/viewings", accent: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  ];

  return (
    <AppShell agencyLogoUrl={agency.logo_url} agencyName={agency.name} currentPath="/dashboard" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-[1400px] space-y-8">
        <PageHeading eyebrow="Agency overview" title={`Ku soo dhowow, ${agency.name}`} description="La soco properties-ka, leads-ka iyo hawlaha team-kaaga hal dashboard oo ammaan ah." action={<span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold capitalize text-emerald-800">{membership.role}</span>} />
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => <Link className="diini-lift group relative overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)] hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,23,42,.08)]" href={stat.href} key={stat.label}><div className="flex items-start justify-between"><div className={`inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-bold ${stat.accent}`}><span className={`h-1.5 w-1.5 rounded-full ${stat.dot}`}/>{stat.label}</div><span className="text-lg text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700">→</span></div><p className="mt-6 text-4xl font-extrabold tracking-[-.05em] text-slate-950">{stat.value}</p><p className="mt-1.5 text-[13px] text-slate-500">{stat.detail}</p></Link>)}
        </section>
        <section className="rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)] sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.16em] text-emerald-700 uppercase">Sales performance</p><h2 className="mt-2 text-xl font-black">Transactions & revenue</h2></div><Link className="text-sm font-bold text-emerald-700" href="/transactions">Dhammaan transactions →</Link></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[{ label: "Completed deals", value: finance.completedDeals }, { label: "Revenue (completed)", value: `USD ${finance.revenue.toLocaleString()}` }, { label: "Collected (active deals)", value: `USD ${finance.deposits.toLocaleString()}` }, { label: "Outstanding (pending)", value: `USD ${finance.remaining.toLocaleString()}` }, { label: "Conversion rate", value: `${conversionRate}%` }].map(item => <div className="rounded-2xl bg-slate-50 p-4" key={item.label}><p className="text-xs font-bold text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p></div>)}</div></section>
        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)] sm:p-7">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-950">Leads-kii ugu dambeeyey</h2><p className="mt-1 text-sm text-slate-500">Xiriirrada cusub ee agency-ga.</p></div><Link className="text-sm font-bold text-emerald-700" href="/leads">Dhammaan eeg →</Link></div>
            <div className="mt-5">{recentLeads.data?.length ? <div className="divide-y divide-slate-100">{recentLeads.data.map((lead) => <div className="flex items-center justify-between gap-4 py-4" key={lead.id}><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{lead.name || lead.phone || "Lead aan magac lahayn"}</p><p className="mt-1 text-xs capitalize text-slate-500">{lead.source} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(lead.created_at))}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-600">{lead.status}</span></div>)}</div> : <EmptyState title="Weli lead ma jiro" description="Leads-ka cusub waxay halkan kasoo muuqan doonaan marka la diiwaangeliyo." />}</div>
          </div>
          <aside className="relative overflow-hidden rounded-[1.6rem] bg-[#08111f] p-7 text-white shadow-[0_18px_50px_rgba(8,17,31,.16)] before:absolute before:-right-16 before:-top-16 before:h-48 before:w-48 before:rounded-full before:bg-emerald-400/10">
            <p className="text-xs font-bold tracking-[0.18em] text-emerald-400 uppercase">Workspace health</p><h2 className="mt-3 text-2xl font-bold">Aasaaska waa diyaar.</h2><p className="mt-3 text-sm leading-6 text-slate-300">Authentication, tenant isolation iyo agency workspace-kaagu dhammaantood way shaqaynayaan.</p>
            <div className="mt-6 space-y-3">{["Supabase Auth connected", "RLS tenant security", "Agency profile active"].map((item) => <div className="flex items-center gap-3 text-sm" key={item}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-slate-950">✓</span>{item}</div>)}</div>
            <Link className="mt-7 inline-flex rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_8px_20px_rgba(16,185,129,.2)] transition hover:bg-emerald-300" href="/settings">Agency settings →</Link>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}


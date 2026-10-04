import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeading } from "@/components/dashboard/page-heading";
import { getPlatformAdmin } from "@/lib/platform-admin";

export default async function AdminOverviewPage() {
  const { user, supabase } = await getPlatformAdmin();
  const { data } = await supabase.rpc("get_platform_overview");
  const stats = (data ?? {}) as Record<string, number>;
  const cards = [
    ["Total agencies", stats.total_agencies ?? 0], ["Active", stats.active_agencies ?? 0],
    ["Trials", stats.trial_agencies ?? 0], ["Suspended", stats.suspended_agencies ?? 0],
    ["Properties", stats.total_properties ?? 0], ["Leads", stats.total_leads ?? 0], ["Conversations", stats.total_conversations ?? 0],
    ["AI conversations (month)", stats.monthly_ai_conversations ?? 0],
  ];
  const estimatedCost = Number(stats.monthly_ai_cost_usd ?? 0);
  return <AdminShell currentPath="/admin" userEmail={user.email}><div className="mx-auto max-w-7xl space-y-8"><PageHeading eyebrow="Platform overview" title="DIINI Super Admin" description="La soco tenant accounts, platform activity iyo usage foundation-ka." /><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></article>)}</section><section className="grid gap-4 md:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold text-slate-950">Usage foundation</h2><p className="mt-3 text-3xl font-black">${estimatedCost.toFixed(4)}</p><p className="mt-1 text-sm text-slate-500">Estimated AI cost bishan. Wax fake data ah lama tusayo.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold text-slate-950">Billing status</h2><p className="mt-3 text-sm text-slate-600">Plans iyo usage schema waa diyaar. Payment provider iyo MRR wali lama hirgelin.</p></article></section></div></AdminShell>;
}

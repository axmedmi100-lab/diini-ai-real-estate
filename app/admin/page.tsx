import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeading } from "@/components/dashboard/page-heading";
import { getPlatformAdmin } from "@/lib/platform-admin";

export default async function AdminOverviewPage() {
  const { user, admin } = await getPlatformAdmin();
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [agencies, properties, leads, conversations, usage] = await Promise.all([
    admin.from("agencies").select("lifecycle_status"),
    admin.from("properties").select("id", { count: "exact", head: true }),
    admin.from("leads").select("id", { count: "exact", head: true }),
    admin.from("conversations").select("id", { count: "exact", head: true }),
    admin.from("agency_usage_monthly").select("ai_conversations, estimated_ai_cost_usd, whatsapp_messages").gte("month_start", monthStart.toISOString().slice(0, 10)),
  ]);
  const agencyRows = agencies.data ?? []; const usageRows = usage.data ?? [];
  const cards = [
    ["Total agencies", agencyRows.length], ["Active", agencyRows.filter((a) => a.lifecycle_status === "active").length],
    ["Trials", agencyRows.filter((a) => a.lifecycle_status === "trial").length], ["Suspended", agencyRows.filter((a) => a.lifecycle_status === "suspended").length],
    ["Properties", properties.count ?? 0], ["Leads", leads.count ?? 0], ["Conversations", conversations.count ?? 0],
    ["AI conversations (month)", usageRows.reduce((sum, row) => sum + row.ai_conversations, 0)],
  ];
  const estimatedCost = usageRows.reduce((sum, row) => sum + Number(row.estimated_ai_cost_usd), 0);
  return <AdminShell currentPath="/admin" userEmail={user.email}><div className="mx-auto max-w-7xl space-y-8"><PageHeading eyebrow="Platform overview" title="DIINI Super Admin" description="La soco tenant accounts, platform activity iyo usage foundation-ka." /><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></article>)}</section><section className="grid gap-4 md:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold text-slate-950">Usage foundation</h2><p className="mt-3 text-3xl font-black">${estimatedCost.toFixed(4)}</p><p className="mt-1 text-sm text-slate-500">Estimated AI cost bishan. Wax fake data ah lama tusayo.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold text-slate-950">Billing status</h2><p className="mt-3 text-sm text-slate-600">Plans iyo usage schema waa diyaar. Payment provider iyo MRR wali lama hirgelin.</p></article></section></div></AdminShell>;
}

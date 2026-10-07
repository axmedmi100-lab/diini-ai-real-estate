import { logout } from "@/app/(auth)/actions";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

function meter(label: string, used: number, limit: number, unit = "") {
  const unlimited = limit < 0;
  const percentage = unlimited ? 0 : Math.min((used / Math.max(limit, 1)) * 100, 100);
  return <div><div className="flex justify-between text-sm"><span className="font-semibold">{label}</span><span>{used.toLocaleString()}{unit} / {unlimited ? "Unlimited" : `${limit.toLocaleString()}${unit}`}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${percentage >= 90 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: unlimited ? "0%" : `${percentage}%` }}/></div></div>;
}

export default async function UsagePage() {
  const { supabase, user, agency } = await getAgencyWorkspace();
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const [{ data: usage }, { data: plan }, properties, members, followUps] = await Promise.all([
    supabase.from("agency_usage_monthly").select("ai_conversations,ai_input_tokens,ai_output_tokens,estimated_ai_cost_usd,whatsapp_messages,storage_bytes").eq("agency_id", agency.id).eq("month_start", month).maybeSingle(),
    supabase.from("platform_plans").select("name,limits").eq("code", agency.plan_code).single(),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("agency_id", agency.id),
    supabase.from("agency_members").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).eq("is_active", true),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).gte("created_at", month),
  ]);
  const limits = (plan?.limits ?? {}) as Record<string, number | boolean>;
  const storageGb = Number(usage?.storage_bytes ?? 0) / 1_073_741_824;
  return <AppShell agencyName={agency.name} currentPath="/usage" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-5xl space-y-7"><PageHeading eyebrow="SaaS usage" title="Plan & Usage" description={`${plan?.name ?? agency.plan_code} plan · ${new Date().toLocaleString("en", { month: "long", year: "numeric" })}`}/><section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">AI tokens</p><p className="mt-2 text-2xl font-black">{(Number(usage?.ai_input_tokens ?? 0) + Number(usage?.ai_output_tokens ?? 0)).toLocaleString()}</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Estimated AI cost</p><p className="mt-2 text-2xl font-black">${Number(usage?.estimated_ai_cost_usd ?? 0).toFixed(4)}</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">WhatsApp</p><p className="mt-2 text-2xl font-black">{limits.whatsapp ? "Enabled by plan" : "Not included"}</p></article></section><section className="space-y-6 rounded-2xl border bg-white p-6">{meter("AI conversations", Number(usage?.ai_conversations ?? 0), Number(limits.ai_conversations ?? 0))}{meter("Properties", properties.count ?? 0, Number(limits.properties ?? 0))}{meter("Users", members.count ?? 0, Number(limits.users ?? 0))}{meter("Follow-ups", followUps.count ?? 0, Number(limits.follow_ups ?? 0))}{meter("Storage", Number(storageGb.toFixed(3)), Number(limits.storage_gb ?? 0), " GB")}</section><p className="text-xs text-slate-500">AI cost waxaa laga xisaabiyaa token usage iyo qiimaha provider-ka ee server environment-ka lagu dejiyey. Payment processing wali lama hirgelin.</p></div></AppShell>;
}

import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeading } from "@/components/dashboard/page-heading";
import { getPlatformAdmin } from "@/lib/platform-admin";

export default async function UsagePage() {
  const { user, supabase } = await getPlatformAdmin();
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const [{ data: usage }, { data: agencies }, { data: plans }] = await Promise.all([
    supabase.from("agency_usage_monthly").select("agency_id,ai_conversations,ai_input_tokens,ai_output_tokens,estimated_ai_cost_usd,whatsapp_messages,storage_bytes").eq("month_start", month),
    supabase.from("agencies").select("id,name,plan_code,lifecycle_status").order("name"),
    supabase.from("platform_plans").select("code,monthly_price_usd"),
  ]);
  const usageMap = new Map(usage?.map((item) => [item.agency_id, item]));
  const priceMap = new Map(plans?.map((plan) => [plan.code, Number(plan.monthly_price_usd)]));
  const rows = agencies?.map((agency) => ({ agency, usage: usageMap.get(agency.id), revenue: priceMap.get(agency.plan_code) ?? 0 })) ?? [];
  const totalCost = rows.reduce((sum, row) => sum + Number(row.usage?.estimated_ai_cost_usd ?? 0), 0);
  const totalRevenue = rows.filter((row) => row.agency.lifecycle_status === "active").reduce((sum, row) => sum + row.revenue, 0);
  const totalConversations = rows.reduce((sum, row) => sum + Number(row.usage?.ai_conversations ?? 0), 0);
  return <AdminShell currentPath="/admin/usage" userEmail={user.email}><div className="mx-auto max-w-7xl space-y-7"><PageHeading eyebrow="Cost control" title="Platform usage" description="Bishan: usage iyo estimated AI cost tenant kasta, oo ay ku jiraan kuwa zero usage leh."/><section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">AI conversations</p><p className="mt-2 text-3xl font-black">{totalConversations.toLocaleString()}</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Estimated AI cost</p><p className="mt-2 text-3xl font-black">${totalCost.toFixed(4)}</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Gross margin estimate</p><p className="mt-2 text-3xl font-black">{totalRevenue > 0 ? `$${(totalRevenue - totalCost).toFixed(2)}` : "—"}</p></article></section><section className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Agency","Status","Plan","AI conversations","Tokens in/out","AI cost","WhatsApp","Storage","Margin est."].map((heading) => <th className="px-4 py-3" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y">{rows.map(({ agency, usage: item, revenue }) => { const cost = Number(item?.estimated_ai_cost_usd ?? 0); return <tr key={agency.id}><td className="px-4 py-4 font-bold">{agency.name}</td><td className="px-4 py-4 capitalize">{agency.lifecycle_status}</td><td className="px-4 py-4 capitalize">{agency.plan_code}</td><td className="px-4 py-4">{item?.ai_conversations ?? 0}</td><td className="px-4 py-4">{item?.ai_input_tokens ?? 0} / {item?.ai_output_tokens ?? 0}</td><td className="px-4 py-4">${cost.toFixed(4)}</td><td className="px-4 py-4">{item?.whatsapp_messages ?? 0}</td><td className="px-4 py-4">{(Number(item?.storage_bytes ?? 0) / 1_073_741_824).toFixed(2)} GB</td><td className="px-4 py-4">{revenue > 0 ? `$${(revenue - cost).toFixed(2)}` : "—"}</td></tr>; })}</tbody></table>{!rows.length ? <p className="p-8 text-sm text-slate-500">Agency wali ma jiro.</p> : null}</section></div></AdminShell>;
}

import { removeProviderSecret, saveProviderSecret, testProviderConnection, updateAgencyIntegration, updateProvider } from "@/app/admin/integrations/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthMessage } from "@/components/auth/auth-message";
import { PageHeading } from "@/components/dashboard/page-heading";
import { getPlatformAdmin } from "@/lib/platform-admin";

type Provider = { provider: string; display_name: string; category: string; provisioning_mode: string; is_enabled: boolean; secret_configured: boolean; secret_hint?: string | null; default_monthly_limit: number | null; connected_agencies: number; error_agencies: number; total_agencies: number };
type AgencyIntegration = { provider: string; status: string; platform_enabled: boolean; monthly_limit: number | null; connected_at: string | null; last_error: string | null; last_event_at: string | null };
type Agency = { id: string; name: string; slug: string; plan_code: string; lifecycle_status: string; integrations: AgencyIntegration[] };

export default async function AdminIntegrationsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; provider?: string }> }) {
  const { user, supabase } = await getPlatformAdmin();
  const params = await searchParams;
  const { data, error } = await supabase.rpc("get_platform_integration_control");
  const control = (data ?? { providers: [], agencies: [] }) as { providers: Provider[]; agencies: Agency[] };
  const selectedProvider = params.provider && control.providers.some((p) => p.provider === params.provider) ? params.provider : "all";
  const agencyRows = control.agencies.map((agency) => ({ agency, integrations: selectedProvider === "all" ? agency.integrations : agency.integrations.filter((item) => item.provider === selectedProvider) }));
  const connected = control.providers.reduce((sum, p) => sum + Number(p.connected_agencies), 0);
  const providerErrors = control.providers.reduce((sum, p) => sum + Number(p.error_agencies), 0);

  return <AdminShell currentPath="/admin/integrations" userEmail={user.email}><div className="mx-auto max-w-[1500px] space-y-7">
    <PageHeading eyebrow="Platform channels" title="Integrations Control Center" description="Maamul providers-ka, connection health-ka, agency access-ka iyo usage limits-ka hal meel." />
    <AuthMessage error={params.error || (error ? "Integration control data lama soo qaadi karin. Migration-ka hubi." : undefined)} message={params.message} />

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Providers" value={control.providers.length} tone="slate" />
      <Metric label="Enabled" value={control.providers.filter((p) => p.is_enabled).length} tone="green" />
      <Metric label="Connected agencies" value={connected} tone="blue" />
      <Metric label="Connection errors" value={providerErrors} tone={providerErrors ? "amber" : "green"} />
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      {control.providers.map((provider) => <form action={updateProvider} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" key={provider.provider}>
        <input name="provider" type="hidden" value={provider.provider} />
        <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-slate-950">{provider.display_name}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">{provider.category}</span></div><p className="mt-2 text-xs text-slate-500">{provider.provider} · {provider.connected_agencies}/{provider.total_agencies} connected</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${provider.is_enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{provider.is_enabled ? "Enabled" : "Disabled"}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-slate-600">Provisioning<select className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" defaultValue={provider.provisioning_mode} name="mode"><option value="managed">DIINI managed</option><option value="byok">Agency BYOK</option><option value="hybrid">Hybrid</option></select></label><label className="text-xs font-bold text-slate-600">Default monthly limit<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" defaultValue={provider.default_monthly_limit ?? ""} min="0" name="monthly_limit" placeholder="Unlimited" type="number" /></label><label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700"><input className="h-4 w-4 accent-emerald-600" defaultChecked={provider.is_enabled} name="enabled" type="checkbox" />Platform enabled</label></div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className={`text-xs font-bold ${provider.secret_configured ? "text-emerald-700" : "text-amber-700"}`}>{provider.secret_configured ? `Encrypted credential ${provider.secret_hint || "configured"}` : "Credentials not configured"}{provider.error_agencies ? ` · ${provider.error_agencies} error` : ""}</p><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white">Kaydi provider</button></div>
      </form>)}
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">Encrypted vault</p><h2 className="mt-2 text-xl font-black text-slate-950">Platform API credentials</h2><p className="mt-2 text-sm leading-6 text-slate-500">Secret-ku browser-ka dib looguma soo bandhigo. Server-ku AES-256-GCM ayuu ku encrypt-gareeyaa, database-kana ciphertext keliya ayaa gala.</p></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">{control.providers.filter((provider) => provider.provisioning_mode !== "byok").map((provider) => <article className="rounded-2xl border border-slate-200 p-4" key={`secret-${provider.provider}`}><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-slate-950">{provider.display_name}</h3><p className="mt-1 text-xs text-slate-500">{provider.secret_configured ? provider.secret_hint || "Credential configured" : "No platform credential"}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${provider.secret_configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{provider.secret_configured ? "Secured" : "Required"}</span></div><form action={saveProviderSecret} className="mt-4 flex flex-col gap-2 sm:flex-row"><input name="provider" type="hidden" value={provider.provider}/><input autoComplete="new-password" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" name="secret" placeholder={`Paste ${provider.display_name} API secret`} required type="password"/><button className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950">{provider.secret_configured ? "Replace" : "Save securely"}</button></form>{provider.secret_configured ? <div className="mt-3 flex flex-wrap gap-3">{provider.provider === "openai" ? <form action={testProviderConnection}><input name="provider" type="hidden" value={provider.provider}/><button className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">Test connection</button></form> : null}<form action={removeProviderSecret}><input name="provider" type="hidden" value={provider.provider}/><button className="px-1 py-2 text-xs font-bold text-rose-600">Remove stored credential</button></form></div> : null}</article>)}</div>
    </section>

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center"><div><h2 className="text-lg font-black">Agency connections</h2><p className="mt-1 text-sm text-slate-500">Enable/disable iyo quota override agency kasta.</p></div><form><select className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold" defaultValue={selectedProvider} name="provider"><option value="all">All providers</option>{control.providers.map((p) => <option key={p.provider} value={p.provider}>{p.display_name}</option>)}</select><button className="ml-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold">Filter</button></form></div>
      <div className="divide-y divide-slate-100">{agencyRows.map(({ agency, integrations }) => <article className="p-5" key={agency.id}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-950">{agency.name}</h3><p className="mt-1 text-xs text-slate-500">{agency.slug} · {agency.plan_code} · {agency.lifecycle_status}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{integrations.filter((i) => i.status === "connected").length} connected</span></div><div className="grid gap-3 lg:grid-cols-2">{integrations.map((item) => <form action={updateAgencyIntegration} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end" key={item.provider}><input name="agency_id" type="hidden" value={agency.id}/><input name="provider" type="hidden" value={item.provider}/><div><p className="text-sm font-black capitalize">{item.provider.replaceAll("_", " ")}</p><p className={`mt-1 text-xs font-bold ${item.status === "error" ? "text-red-600" : item.status === "connected" ? "text-emerald-600" : "text-slate-500"}`}>{item.status}{item.last_error ? ` · ${item.last_error}` : ""}</p></div><label className="text-xs font-bold text-slate-600">Monthly limit<input className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" defaultValue={item.monthly_limit ?? ""} min="0" name="monthly_limit" placeholder="Default" type="number"/></label><div className="flex items-center gap-2"><label className="flex items-center gap-2 text-xs font-bold"><input className="h-4 w-4 accent-emerald-600" defaultChecked={item.platform_enabled} name="enabled" type="checkbox"/>Allowed</label><button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Save</button></div></form>)}</div></article>)}</div>
    </section>
  </div></AdminShell>;
}

function Metric({ label, value, tone }: Readonly<{ label: string; value: number; tone: "slate" | "green" | "blue" | "amber" }>) {
  const tones = { slate: "bg-slate-950 text-white", green: "border-emerald-200 bg-emerald-50 text-emerald-950", blue: "border-sky-200 bg-sky-50 text-sky-950", amber: "border-amber-200 bg-amber-50 text-amber-950" };
  return <article className={`rounded-2xl border border-transparent p-5 ${tones[tone]}`}><p className="text-xs font-bold opacity-65">{label}</p><p className="mt-2 text-3xl font-black">{value.toLocaleString()}</p></article>;
}


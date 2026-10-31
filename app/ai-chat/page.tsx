import { headers } from "next/headers";

import { logout } from "@/app/(auth)/actions";
import { updateAIChatSettings } from "@/app/ai-chat/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { getOpenAIKey } from "@/lib/integrations/platform-credentials";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Icon({ name, className = "h-5 w-5" }: Readonly<{ name: string; className?: string }>) {
  const paths: Record<string, React.ReactNode> = {
    spark: <path d="m12 3-1.35 4.1a5.3 5.3 0 0 1-3.55 3.55L3 12l4.1 1.35a5.3 5.3 0 0 1 3.55 3.55L12 21l1.35-4.1a5.3 5.3 0 0 1 3.55-3.55L21 12l-4.1-1.35a5.3 5.3 0 0 1-3.55-3.55L12 3Z" />,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    tune: <><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M22 12h-3"/></>,
    handoff: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m17 11 4-4M17 7h4v4"/></>,
    code: <><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg aria-hidden className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>;
}

function SectionTitle({ icon, title, description }: Readonly<{ icon: string; title: string; description: string }>) {
  return <div className="flex gap-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon name={icon} /></span><div><h2 className="text-base font-extrabold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div></div>;
}

export default async function AIChatPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const messages = await searchParams;
  const { data: settings } = await supabase.from("ai_settings").select("*").eq("agency_id", agency.id).maybeSingle();
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const embed = `<script src="${origin}/widget.js" data-agency-id="${agency.id}"></script>`;
  const canEdit = ["owner", "admin", "manager"].includes(membership.role);
  const input = "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
  const languages = (settings?.supported_languages as string[] | undefined) ?? ["so", "en"];
  const qualificationFields = (settings?.qualification_fields as string[] | undefined) ?? ["purpose", "district", "budget", "bedrooms", "property_type"];
  const hotRules = (settings?.hot_lead_rules as Record<string, boolean | number> | undefined) ?? {};
  const handoffRules = (settings?.handoff_rules as Record<string, boolean> | undefined) ?? {};
  const enabled = settings?.is_enabled ?? false;
  // The platform key is normally stored in the encrypted integration vault,
  // not in OPENAI_API_KEY. Read the same credential source used by the chat
  // route so the status banner reflects the real runtime state.
  let aiReady = false;
  try {
    aiReady = Boolean(await getOpenAIKey());
  } catch (error) {
    console.error("OpenAI readiness check failed", error);
  }

  return (
    <AppShell agencyLogoUrl={agency.logo_url} agencyName={agency.name} currentPath="/ai-chat" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#071522] px-6 py-7 text-white shadow-[0_20px_60px_rgba(2,12,27,.16)] sm:px-8 sm:py-9">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute bottom-0 right-[28%] h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div className="max-w-2xl"><div className="mb-4 flex items-center gap-2 text-[10px] font-black tracking-[.2em] text-emerald-300 uppercase"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400/15"><Icon className="h-4 w-4" name="spark" /></span>AI Reception Studio</div><h1 className="text-3xl font-black tracking-[-.04em] sm:text-4xl">Website-kaaga u yeel receptionist caqli badan.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Habee jawaabaha, qualification-ka iyo human handoff-ka—kadibna hal script ku xiro website-ka agency-ga.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:flex"><Status label="Widget" active={enabled} activeText="Active" inactiveText="Inactive"/><Status label="AI engine" active={aiReady} activeText="Ready" inactiveText="Fallback"/></div>
          </div>
        </section>

        <AuthMessage error={messages.error} message={messages.message} />
        {!aiReady ? <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" name="shield"/><p><strong>Fallback mode:</strong> OpenAI key weli lama gelin. Widget-ku leads iyo conversations wuu kaydinayaa; fahamka AI-ga buuxa wuxuu shaqaynayaa marka key-ga server-ka lagu daro.</p></div> : null}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <form action={updateAIChatSettings} className="space-y-5">
            <Card><SectionTitle icon="message" title="Assistant identity" description="Magaca, luqadaha iyo fariinta ugu horreysa ee booqdaha arko." /><div className="mt-6 grid gap-5 lg:grid-cols-2"><label className="block text-sm font-bold text-slate-700 lg:col-span-2">Magaca assistant-ka<input className={input} defaultValue={settings?.assistant_name || "AI Property Assistant"} disabled={!canEdit} name="assistant_name" required /></label><div className="lg:col-span-2"><p className="text-sm font-bold text-slate-700">Luqadaha</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{[["so", "Soomaali", "Luqadda koowaad"], ["en", "English", "International visitors"]].map(([code, label, hint]) => <Choice key={code} name={`language_${code}`} checked={languages.includes(code)} disabled={!canEdit} label={label} hint={hint}/>)}</div></div><label className="block text-sm font-bold text-slate-700">Welcome message — Soomaali<textarea className={`${input} min-h-28 resize-y`} defaultValue={settings?.welcome_message_so || "Ku soo dhowow. Sideen kaa caawin karaa raadinta guriga?"} disabled={!canEdit} name="welcome_message_so" /></label><label className="block text-sm font-bold text-slate-700">Welcome message — English<textarea className={`${input} min-h-28 resize-y`} defaultValue={settings?.welcome_message_en || "Welcome. How can I help with your property search?"} disabled={!canEdit} name="welcome_message_en" /></label></div></Card>

            <Card><SectionTitle icon="target" title="Lead qualification" description="Dooro xogta uu assistant-ku ururinayo kahor inta lead-ku u gudbin team-ka." /><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["purpose", "Kiro ama iib"], ["district", "Degmada"], ["budget", "Budget"], ["bedrooms", "Qolalka"], ["property_type", "Nooca property-ga"], ["furnished", "Furnished"], ["timeline", "Goorta uu diyaar yahay"]].map(([key, label]) => <Check key={key} name={`qualify_${key}`} checked={qualificationFields.includes(key)} disabled={!canEdit} label={label}/>)}</div></Card>

            <div className="grid gap-5 lg:grid-cols-2"><fieldset className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,.045)] sm:p-7"><legend className="sr-only">Hot lead rules</legend><SectionTitle icon="spark" title="Hot lead signals" description="Goorta lead-ka loo aqoonsanayo fursad kulul."/><div className="mt-6 space-y-3">{[["contact_details", "Contact details waa la bixiyey"], ["budget_known", "Budget waa la yaqaan"], ["viewing_requested", "Viewing ayaa la codsaday"]].map(([key, label]) => <SimpleCheck key={key} name={`hot_${key}`} checked={hotRules[key] !== false} disabled={!canEdit} label={label}/>)}<label className="block pt-2 text-sm font-bold text-slate-700">Ready within days<input className={input} defaultValue={Number(hotRules.ready_within_days ?? 30)} disabled={!canEdit} max="365" min="1" name="ready_within_days" type="number" /></label></div></fieldset><fieldset className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,.045)] sm:p-7"><legend className="sr-only">Human handoff rules</legend><SectionTitle icon="handoff" title="Human handoff" description="Xaaladaha conversation-ka loo wareejinayo qof."/><div className="mt-6 space-y-3">{[["customer_requests_human", "Macmiilku qof ayuu codsaday"], ["complaint", "Cabasho"], ["negotiation", "Wada-xaajood"], ["low_confidence", "AI confidence hooseeya"]].map(([key, label]) => <SimpleCheck key={key} name={`handoff_${key}`} checked={handoffRules[key] ?? key === "customer_requests_human"} disabled={!canEdit} label={label}/>)}</div></fieldset></div>

            <Card><SectionTitle icon="tune" title="Rules & activation" description="Sii assistant-ka tilmaamo ganacsi, kadibna go'aami inuu live noqdo."/><label className="mt-6 block text-sm font-bold text-slate-700">Business rules<textarea className={`${input} min-h-32 resize-y`} defaultValue={settings?.business_rules || ""} disabled={!canEdit} maxLength={3000} name="business_rules" placeholder="Tusaale: Ha ballanqaadin qiimo-dhimis; viewing-yada xaqiiji ka hor..." /></label><div className="mt-5 grid gap-3 sm:grid-cols-2"><Toggle name="human_handoff_enabled" checked={settings?.human_handoff_enabled ?? true} disabled={!canEdit} label="Human handoff" hint="U oggolow AI-ga inuu qof u wareejiyo"/><Toggle name="is_enabled" checked={enabled} disabled={!canEdit} label="Website chat" hint="Ka dhig widget-ka mid live ah" green/></div>{canEdit ? <div className="mt-6 flex justify-end"><button className="inline-flex items-center gap-2 rounded-xl bg-[#071522] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-600"><Icon className="h-4 w-4" name="check"/>Kaydi AI settings</button></div> : null}</Card>

            <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,.045)]"><div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7"><SectionTitle icon="code" title="Embed code" description="Ku geli website-ka ka hor closing body tag-ga."/><span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black tracking-wider text-slate-500 uppercase sm:block">One-time setup</span></div><div className="bg-[#071522] p-5 sm:p-7"><pre className="overflow-x-auto text-xs leading-6 text-emerald-300"><code>{embed}</code></pre></div></section>
          </form>

          <aside className="xl:sticky xl:top-28"><section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,.10)]"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-black tracking-[.18em] text-emerald-600 uppercase">Live preview</p><p className="mt-1 text-sm font-bold text-slate-900">Sida booqdaha u arko</p></div><span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>Interactive</span></div><div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.12),transparent_45%),#071522] p-4 sm:p-5"><div className="mx-auto max-w-[380px] overflow-hidden rounded-[1.7rem] border border-white/10 bg-white shadow-2xl"><div className="flex items-center justify-center gap-1.5 bg-slate-100 py-2.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-300"/><span className="h-1.5 w-1.5 rounded-full bg-slate-300"/><span className="h-1.5 w-8 rounded-full bg-slate-300"/></div><iframe className="h-[600px] w-full border-0 bg-white" src={`/widget/${agency.id}`} title="AI chat preview" /></div></div><div className="flex items-start gap-3 px-5 py-4 text-xs leading-5 text-slate-500"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" name="globe"/><p>Preview-gu wuxuu isticmaalayaa settings-ka ugu dambeeyey ee la kaydiyey. Isbeddel samee, kadibna guji <strong className="text-slate-700">Kaydi AI settings</strong>.</p></div></section></aside>
        </div>
      </div>
    </AppShell>
  );
}

function Status({ label, active, activeText, inactiveText }: Readonly<{ label: string; active: boolean; activeText: string; inactiveText: string }>) { return <div className="rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 backdrop-blur"><p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</p><p className={`mt-1 flex items-center gap-2 text-sm font-bold ${active ? "text-emerald-300" : "text-amber-300"}`}><span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-amber-400"}`} />{active ? activeText : inactiveText}</p></div>; }
function Card({ children }: Readonly<{ children: React.ReactNode }>) { return <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,.045)] sm:p-7">{children}</section>; }
function Choice({ name, checked, disabled, label, hint }: Readonly<{ name: string; checked: boolean; disabled: boolean; label: string; hint: string }>) { return <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition hover:border-emerald-300 hover:bg-emerald-50/40"><input className="h-4 w-4 accent-emerald-600" defaultChecked={checked} disabled={disabled} name={name} type="checkbox" /><span><span className="block text-sm font-bold text-slate-800">{label}</span><span className="text-xs text-slate-500">{hint}</span></span></label>; }
function Check({ name, checked, disabled, label }: Readonly<{ name: string; checked: boolean; disabled: boolean; label: string }>) { return <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/40"><input className="h-4 w-4 accent-emerald-600" defaultChecked={checked} disabled={disabled} name={name} type="checkbox" />{label}</label>; }
function SimpleCheck({ name, checked, disabled, label }: Readonly<{ name: string; checked: boolean; disabled: boolean; label: string }>) { return <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input className="h-4 w-4 accent-emerald-600" defaultChecked={checked} disabled={disabled} name={name} type="checkbox" />{label}</label>; }
function Toggle({ name, checked, disabled, label, hint, green = false }: Readonly<{ name: string; checked: boolean; disabled: boolean; label: string; hint: string; green?: boolean }>) { return <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 ${green ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200"}`}><span><span className={`block text-sm font-bold ${green ? "text-emerald-950" : "text-slate-900"}`}>{label}</span><span className={`mt-1 block text-xs ${green ? "text-emerald-700" : "text-slate-500"}`}>{hint}</span></span><input className="h-5 w-5 accent-emerald-600" defaultChecked={checked} disabled={disabled} name={name} type="checkbox" /></label>; }


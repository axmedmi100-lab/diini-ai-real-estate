import { headers } from "next/headers";

import { logout } from "@/app/(auth)/actions";
import { updateAIChatSettings } from "@/app/ai-chat/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

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
  const input = "mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";
  const languages = (settings?.supported_languages as string[] | undefined) ?? ["so", "en"];
  const qualificationFields = (settings?.qualification_fields as string[] | undefined) ?? ["purpose", "district", "budget", "bedrooms", "property_type"];
  const hotRules = (settings?.hot_lead_rules as Record<string, boolean | number> | undefined) ?? {};
  const handoffRules = (settings?.handoff_rules as Record<string, boolean> | undefined) ?? {};

  return (
    <AppShell agencyName={agency.name} currentPath="/ai-chat" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeading eyebrow="Website intelligence" title="AI Website Chat" description="Habee assistant-ka, tijaabi widget-ka, kadib script-ka geli website-ka agency-ga." />
        <AuthMessage error={messages.error} message={messages.message} />
        {!process.env.OPENAI_API_KEY ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Fallback mode:</strong> `OPENAI_API_KEY` weli lama gelin. Widget-ku wuu shaqaynayaa oo wuxuu kaydinayaa leads/conversations, laakiin fahamka AI-ga buuxa wuxuu bilaabanayaa marka key-ga lagu daro `.env.local`.</div> : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">OpenAI Responses API waa diyaar · {process.env.OPENAI_MODEL || "gpt-6-luna"}</div>}
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <form action={updateAIChatSettings} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-bold text-slate-950">Assistant settings</h2>
              <div className="mt-6 space-y-7">
                <label className="block text-sm font-semibold text-slate-700">Magaca assistant-ka<input className={input} defaultValue={settings?.assistant_name || "AI Property Assistant"} disabled={!canEdit} name="assistant_name" required /></label>
                <div><p className="text-sm font-bold text-slate-800">Luqadaha assistant-ka</p><div className="mt-3 flex flex-wrap gap-4">{[["so", "Soomaali"], ["en", "English"]].map(([code, label]) => <label className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={code}><input defaultChecked={languages.includes(code)} disabled={!canEdit} name={`language_${code}`} type="checkbox" />{label}</label>)}</div></div>
                <label className="block text-sm font-semibold text-slate-700">Welcome message — Soomaali<textarea className={`${input} min-h-24`} defaultValue={settings?.welcome_message_so || "Ku soo dhowow. Sideen kaa caawin karaa raadinta guriga?"} disabled={!canEdit} name="welcome_message_so" /></label>
                <label className="block text-sm font-semibold text-slate-700">Welcome message — English<textarea className={`${input} min-h-24`} defaultValue={settings?.welcome_message_en || "Welcome. How can I help with your property search?"} disabled={!canEdit} name="welcome_message_en" /></label>
                <fieldset><legend className="text-sm font-bold text-slate-800">Qualification fields</legend><p className="mt-1 text-xs text-slate-500">Macluumaadka muhiimka ah ee AI-gu macmiilka weydiinayo.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{[["purpose", "Kiro ama iib"], ["district", "Degmada"], ["budget", "Budget"], ["bedrooms", "Qolalka"], ["property_type", "Nooca property-ga"], ["furnished", "Furnished"], ["timeline", "Goorta uu diyaar yahay"]].map(([key, label]) => <label className="flex items-center gap-2 text-sm text-slate-700" key={key}><input defaultChecked={qualificationFields.includes(key)} disabled={!canEdit} name={`qualify_${key}`} type="checkbox" />{label}</label>)}</div></fieldset>
                <fieldset className="rounded-2xl border border-slate-200 p-4"><legend className="px-2 text-sm font-bold text-slate-800">Hot lead rules</legend><div className="grid gap-3 sm:grid-cols-2">{[["contact_details", "Contact details waa la bixiyey"], ["budget_known", "Budget waa la yaqaan"], ["viewing_requested", "Viewing ayaa la codsaday"]].map(([key, label]) => <label className="flex items-center gap-2 text-sm text-slate-700" key={key}><input defaultChecked={hotRules[key] !== false} disabled={!canEdit} name={`hot_${key}`} type="checkbox" />{label}</label>)}<label className="text-sm font-semibold text-slate-700">Ready within days<input className={input} defaultValue={Number(hotRules.ready_within_days ?? 30)} disabled={!canEdit} max="365" min="1" name="ready_within_days" type="number" /></label></div></fieldset>
                <fieldset className="rounded-2xl border border-slate-200 p-4"><legend className="px-2 text-sm font-bold text-slate-800">Human handoff rules</legend><div className="grid gap-3 sm:grid-cols-2">{[["customer_requests_human", "Macmiilku qof ayuu codsaday"], ["complaint", "Cabasho"], ["negotiation", "Wada-xaajood"], ["low_confidence", "AI confidence hooseeya"]].map(([key, label]) => <label className="flex items-center gap-2 text-sm text-slate-700" key={key}><input defaultChecked={handoffRules[key] ?? key === "customer_requests_human"} disabled={!canEdit} name={`handoff_${key}`} type="checkbox" />{label}</label>)}</div></fieldset>
                <label className="block text-sm font-semibold text-slate-700">Business rules<textarea className={`${input} min-h-28`} defaultValue={settings?.business_rules || ""} disabled={!canEdit} maxLength={3000} name="business_rules" placeholder="Tusaale: Ha ballanqaadin qiimo-dhimis; viewing-yada xaqiiji ka hor..." /></label>
                <label className="flex items-center gap-3 text-sm font-semibold text-slate-700"><input className="h-4 w-4" defaultChecked={settings?.human_handoff_enabled ?? true} disabled={!canEdit} name="human_handoff_enabled" type="checkbox" />Human handoff</label>
                <label className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900"><input className="h-5 w-5" defaultChecked={settings?.is_enabled ?? false} disabled={!canEdit} name="is_enabled" type="checkbox" />Hawlgeli website chat-ka</label>
              </div>{canEdit ? <button className="mt-7 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Kaydi AI settings</button> : null}
            </form>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-bold text-slate-950">Embed code</h2><p className="mt-2 text-sm leading-6 text-slate-500">Hal mar ku geli code-kan website-ka agency-ga, ka hor `&lt;/body&gt;`.</p><pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-emerald-300"><code>{embed}</code></pre></section>
          </div>
          <section className="rounded-3xl border border-slate-200 bg-slate-900 p-4 shadow-sm"><p className="mb-3 text-xs font-bold tracking-wide text-slate-400 uppercase">Live preview</p><iframe className="h-[620px] w-full rounded-[1.75rem] border-0 bg-transparent" src={`/widget/${agency.id}`} title="AI chat preview" /></section>
        </div>
      </div>
    </AppShell>
  );
}

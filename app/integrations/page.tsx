import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

const catalog = [
  { provider: "website_ai", name: "Website AI", description: "AI widget-ka website-ka oo qaata leads iyo property requests.", available: true },
  { provider: "email", name: "Email", description: "Email inbox iyo outbound automation foundation.", available: false },
  { provider: "whatsapp", name: "WhatsApp", description: "Meta WhatsApp Cloud API: webhook, unified inbox, AI iyo human takeover.", available: true },
  { provider: "voice", name: "AI Voice", description: "Wicitaanno iyo AI receptionist.", available: false },
  { provider: "facebook", name: "Facebook", description: "Facebook lead iyo message connection.", available: false },
  { provider: "instagram", name: "Instagram", description: "Instagram DM iyo lead connection.", available: false },
] as const;

export default async function IntegrationsPage() {
  const { supabase, user, agency } = await getAgencyWorkspace();
  const [{ data: rows }, { data: ai }] = await Promise.all([
    supabase.from("integrations").select("provider,status,connected_at").eq("agency_id", agency.id),
    supabase.from("ai_settings").select("is_enabled").eq("agency_id", agency.id).maybeSingle(),
  ]);
  const states = new Map((rows ?? []).map((row) => [row.provider, row]));

  return (
    <AppShell agencyName={agency.name} currentPath="/integrations" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-[1400px] space-y-8">
        <PageHeading eyebrow="Channels & connections" title="Integrations" description="Hal meel ka eeg xaaladda channels-ka agency-ga. Xiriirrada mustaqbalka si cad ayaa loo kala saaray." />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map((item) => {
            const stored = states.get(item.provider);
            const connected = item.provider === "website_ai" ? Boolean(ai?.is_enabled) : stored?.status === "connected";
            return <article className="diini-lift flex min-h-64 flex-col rounded-[1.6rem] border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.03)] hover:border-emerald-200 hover:shadow-[0_16px_40px_rgba(15,23,42,.08)]" key={item.provider}>
              <div className="flex items-start justify-between gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#08111f] text-lg font-black text-emerald-400 shadow-lg shadow-slate-900/10">{item.name.slice(0, 1)}</div><span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-400"}`}/>{connected ? "Connected" : "Not connected"}</span></div>
              <h2 className="mt-5 text-xl font-black text-slate-950">{item.name}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
              <div className="mt-auto pt-6">{item.available ? <Link className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600" href={item.provider === "whatsapp" ? "/integrations/whatsapp" : "/ai-chat"}>{connected ? "Manage settings" : item.provider === "whatsapp" ? "Connect WhatsApp" : "Set up Website AI"}<span>→</span></Link> : <button className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-400" disabled>Coming soon</button>}</div>
            </article>;
          })}
        </div>
      </div>
    </AppShell>
  );
}


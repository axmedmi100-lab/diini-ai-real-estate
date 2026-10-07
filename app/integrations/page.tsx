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
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeading eyebrow="Channels & connections" title="Integrations" description="Hal meel ka eeg xaaladda channels-ka agency-ga. Xiriirrada mustaqbalka si cad ayaa loo kala saaray." />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map((item) => {
            const stored = states.get(item.provider);
            const connected = item.provider === "website_ai" ? Boolean(ai?.is_enabled) : stored?.status === "connected";
            return <article className="flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" key={item.provider}>
              <div className="flex items-start justify-between gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-xl text-white">{item.name.slice(0, 1)}</div><span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{connected ? "Connected" : "Not connected"}</span></div>
              <h2 className="mt-5 text-xl font-black text-slate-950">{item.name}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
              <div className="mt-auto pt-6">{item.available ? <Link className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" href={item.provider === "whatsapp" ? "/integrations/whatsapp" : "/ai-chat"}>{connected ? "Manage settings" : item.provider === "whatsapp" ? "Connect WhatsApp" : "Set up Website AI"}</Link> : <button className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-400" disabled>Coming soon</button>}</div>
            </article>;
          })}
        </div>
      </div>
    </AppShell>
  );
}

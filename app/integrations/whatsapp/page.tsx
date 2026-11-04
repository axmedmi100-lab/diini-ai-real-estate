import { logout } from "@/app/(auth)/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { PageHeading } from "@/components/dashboard/page-heading";
import { WhatsAppEmbeddedSignup } from "@/components/integrations/whatsapp-embedded-signup";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission } from "@/lib/permissions";
import { getEvolutionQr, refreshEvolutionInstance } from "@/lib/whatsapp/evolution";
import { connectEvolutionWhatsApp, connectWhatsApp, disconnectEvolutionWhatsApp, disconnectWhatsApp, refreshEvolutionWhatsApp } from "./actions";

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const query = await searchParams;
  const { data: integration } = await supabase.from("integrations").select("status,public_config,secret_reference,connected_at").eq("agency_id", agency.id).eq("provider", "whatsapp").maybeSingle();
  const config = (integration?.public_config ?? {}) as Record<string, string>;
  const evolutionEnabled = process.env.EVOLUTION_ENABLED === "true";
  const canManage = hasAgencyPermission(membership.role, "manage_agency");
  let evolution = null;
  let qr: string | null = null;
  let evolutionError: string | null = null;
  if (evolutionEnabled) {
    try {
      evolution = await refreshEvolutionInstance(agency.id);
      if (canManage && evolution && evolution.connectionStatus !== "open") qr = await getEvolutionQr(evolution.instanceName);
    } catch (error) { evolutionError = error instanceof Error ? error.message : "Evolution API lama xiriiri karin."; }
  }
  const evolutionConnected = evolution?.connectionStatus === "open";
  const metaConnected = integration?.status === "connected" && config.provider_mode !== "evolution";

  return <AppShell agencyLogoUrl={agency.logo_url} agencyName={agency.name} currentPath="/integrations" logoutAction={logout} userEmail={user.email}>
    <div className="mx-auto w-full max-w-4xl space-y-7">
      <PageHeading eyebrow="WhatsApp AI" title="Connect WhatsApp" description="Agency kasta wuxuu helayaa Evolution instance iyo QR u gaar ah; API key-ga platform-ka macmiilka looma bandhigo." />
      <AuthMessage error={query.error || evolutionError || undefined} message={query.message} />

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Evolution QR connection</h2><p className="mt-1 text-sm text-slate-500">WhatsApp → Linked devices → Link a device</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${evolutionConnected ? "bg-emerald-100 text-emerald-800" : evolution ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{evolutionConnected ? "Connected" : evolution ? "Waiting for QR" : "Not connected"}</span></div>
        {!canManage ? <p className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Owner, admin ama manager ayaa maamuli kara WhatsApp connection-ka.</p> : !evolutionEnabled ? <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Evolution API-ga platform-ka lama hawlgelin. La xiriir DIINI Super Admin.</p> : evolutionConnected ? <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end"><div className="space-y-2 text-sm"><p><strong>Instance:</strong> <code>{evolution?.instanceName}</code></p><p><strong>WhatsApp:</strong> {evolution?.ownerJid?.replace(/@.*$/, "") || "Connected"}</p><p className="text-emerald-700">AI replies, leads iyo viewings waxay ku xiran yihiin agency-gan.</p></div><form action={disconnectEvolutionWhatsApp}><button className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-bold text-rose-700">Disconnect</button></form></div> : evolution ? <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr] md:items-center"><div className="grid min-h-64 place-items-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-4">{qr ? <img alt="WhatsApp connection QR code" className="h-60 w-60 rounded-2xl bg-white object-contain p-2" src={qr} /> : <p className="text-center text-sm text-amber-800">QR lama helin. Refresh QR isku day.</p>}</div><div><h3 className="text-lg font-black">Ku scan-garee telefoonka macmiilka</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>WhatsApp ka fur telefoonka.</li><li>Gal Linked devices.</li><li>Riix Link a device.</li><li>Scan QR code-kan.</li></ol><form action={refreshEvolutionWhatsApp}><button className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Refresh QR / Check status</button></form></div></div> : <form action={connectEvolutionWhatsApp} className="mt-6 rounded-2xl bg-slate-50 p-5"><h3 className="font-black">Samee connection agency-gan</h3><p className="mt-2 text-sm leading-6 text-slate-600">DIINI wuxuu si ammaan ah u abuuri doonaa instance gaar ah. Macmiilku QR oo keliya ayuu scan-garaynayaa.</p><button className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950">Create WhatsApp QR</button></form>}
      </section>

      <details className="rounded-3xl border bg-white p-6"><summary className="cursor-pointer font-black">Official Meta Cloud API option</summary><div className="mt-5">{metaConnected ? <div className="space-y-3 text-sm"><p><strong>Verified name:</strong> {config.verified_name || "—"}</p><p><strong>Phone:</strong> {config.display_phone_number || "—"}</p><form action={disconnectWhatsApp}><button className="rounded-xl border border-rose-300 px-4 py-2.5 font-bold text-rose-700">Disconnect Meta</button></form></div> : <><div className="rounded-2xl bg-slate-50 p-5"><h3 className="font-black">Meta Embedded Signup</h3><p className="mt-2 text-sm text-slate-600">Production-ka rasmiga ah waxaa lagu xiri karaa Meta Cloud API.</p><div className="mt-4"><WhatsAppEmbeddedSignup appId={process.env.NEXT_PUBLIC_META_APP_ID} configId={process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID} enabled /></div></div><details className="mt-5 rounded-2xl border p-4"><summary className="cursor-pointer text-sm font-bold">Developer manual setup</summary><form action={connectWhatsApp} className="mt-4 grid gap-4"><label className="text-sm font-bold">Meta Phone Number ID<input className="mt-2 w-full rounded-xl border p-3 font-normal" name="phone_number_id" required /></label><label className="text-sm font-bold">WhatsApp Business Account ID<input className="mt-2 w-full rounded-xl border p-3 font-normal" name="business_account_id" required /></label><label className="text-sm font-bold">Token environment variable name<input className="mt-2 w-full rounded-xl border p-3 font-mono font-normal" name="secret_reference" required /></label><button className="w-fit rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Verify & Connect manually</button></form></details></>}</div></details>
    </div>
  </AppShell>;
}


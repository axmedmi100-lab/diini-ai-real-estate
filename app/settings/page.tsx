import { logout } from "@/app/(auth)/actions";
import { removeAgencyLogo, updateAgency, updateAgencyLogo } from "@/app/settings/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { user, membership, agency } = await getAgencyWorkspace();
  const params = await searchParams;
  const canEdit = ["owner", "admin", "manager"].includes(membership.role);
  const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";

  return (
    <AppShell agencyLogoUrl={agency.logo_url} agencyName={agency.name} currentPath="/settings" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <PageHeading eyebrow="Workspace" title="Agency settings" description="Maamul magaca, xiriirka iyo defaults-ka agency-gaaga." />
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-inner">
                {agency.logo_url ? <img alt={`${agency.name} logo`} className="h-full w-full object-contain p-2" src={agency.logo_url} /> : <span className="text-3xl font-black text-emerald-600">{agency.name.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div><p className="text-xs font-black tracking-[.16em] text-emerald-700 uppercase">Agency branding</p><h2 className="mt-1 text-xl font-black">Logo-ga agency-ga</h2><p className="mt-1 text-sm text-slate-500">PNG, JPG, WebP ama SVG · ugu badnaan 2 MB.</p></div>
            </div>
            {canEdit ? <div className="flex flex-wrap gap-2"><form action={updateAgencyLogo} className="flex flex-wrap items-center gap-2"><input accept="image/png,image/jpeg,image/webp,image/svg+xml" className="max-w-56 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:font-bold file:text-white" name="logo" required type="file" /><button className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400" type="submit">Kaydi logo</button></form>{agency.logo_url ? <form action={removeAgencyLogo}><button className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50" type="submit">Ka saar</button></form> : null}</div> : null}
          </div>
        </section>
        <form action={updateAgency} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <AuthMessage error={params.error} message={params.message} />
          <div className="mt-2 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Magaca agency-ga<input className={inputClass} defaultValue={agency.name} disabled={!canEdit} name="name" required /></label>
            <label className="text-sm font-semibold text-slate-700">Phone<input className={inputClass} defaultValue={agency.phone ?? ""} disabled={!canEdit} name="phone" placeholder="+252..." /></label>
            <label className="text-sm font-semibold text-slate-700">WhatsApp<input className={inputClass} defaultValue={agency.whatsapp ?? ""} disabled={!canEdit} name="whatsapp" placeholder="+252..." /></label>
            <label className="text-sm font-semibold text-slate-700">Agency email<input className={inputClass} defaultValue={agency.email ?? ""} disabled={!canEdit} name="email" type="email" /></label>
            <label className="text-sm font-semibold text-slate-700">Website<input className={inputClass} defaultValue={agency.website ?? ""} disabled={!canEdit} name="website" placeholder="https://" type="url" /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Cinwaanka<input className={inputClass} defaultValue={agency.address ?? ""} disabled={!canEdit} name="address" /></label>
            <label className="text-sm font-semibold text-slate-700">Luqadda<select className={inputClass} defaultValue={agency.default_language} disabled={!canEdit} name="default_language"><option value="so">Af-Soomaali</option><option value="en">English</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Lacagta<select className={inputClass} defaultValue={agency.default_currency} disabled={!canEdit} name="default_currency"><option value="USD">USD</option><option value="SOS">SOS</option><option value="KES">KES</option></select></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Timezone<select className={inputClass} defaultValue={agency.timezone} disabled={!canEdit} name="timezone"><option value="Africa/Mogadishu">Africa/Mogadishu</option><option value="Africa/Nairobi">Africa/Nairobi</option><option value="Europe/London">Europe/London</option></select></label>
          </div>
          {canEdit ? <button className="mt-7 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800" type="submit">Kaydi settings-ka</button> : <p className="mt-6 text-sm text-amber-700">Role-kaagu wuxuu kuu oggolaanayaa akhris oo keliya.</p>}
        </form>
      </div>
    </AppShell>
  );
}


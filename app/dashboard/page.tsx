import { redirect } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("agency_members")
    .select("role, agencies(name)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const agencyRelation = membership?.agencies as
    | { name: string }
    | { name: string }[]
    | null
    | undefined;
  const agency = Array.isArray(agencyRelation)
    ? agencyRelation[0]?.name
    : agencyRelation?.name;

  return (
    <AppShell agencyName={agency ?? "Agency workspace"} userEmail={user.email} logoutAction={logout}>
      <section className="mx-auto flex w-full max-w-5xl flex-1 items-center">
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-6 py-10 sm:px-10 sm:py-14">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-800 uppercase">Secure workspace</span>
            <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Never lose a property lead again.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Ku soo dhowow {agency ?? "agency-gaaga"}. Dashboard-kan waxaa geli kara oo keliya users-ka la xaqiijiyey.</p>
          </div>
          <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
            {[["Role", membership?.role ?? "owner"], ["Authentication", "Supabase Auth"], ["Tenant security", "RLS enforced"]].map(([title, description]) => (
              <article className="bg-white p-6" key={title}>
                <h2 className="font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm capitalize leading-6 text-slate-500">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

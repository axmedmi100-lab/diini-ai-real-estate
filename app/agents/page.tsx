import { logout } from "@/app/(auth)/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function AgentsPage() {
  const { supabase, user, agency } = await getAgencyWorkspace();
  const { data: members } = await supabase.from("agency_members").select("id, user_id, role, is_active, created_at").eq("agency_id", agency.id).order("created_at");
  const ids = members?.map((member) => member.user_id) ?? [];
  const { data: profiles } = ids.length ? await supabase.from("user_profiles").select("id, full_name, phone").in("id", ids) : { data: [] };
  const profileById = new Map(profiles?.map((profile) => [profile.id, profile]));

  return (
    <AppShell agencyName={agency.name} currentPath="/agents" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeading eyebrow="Team" title="Agents" description="Dadka ka shaqeeya workspace-kan iyo roles-kooda." action={<span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">{members?.length ?? 0} members</span>} />
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {members?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{members.map((member) => { const profile = profileById.get(member.user_id); const name = profile?.full_name || (member.user_id === user.id ? user.email : "Agency member"); return <article className="rounded-2xl border border-slate-200 p-5" key={member.id}><div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 font-bold text-emerald-800">{String(name).slice(0, 2).toUpperCase()}</div><div className="min-w-0"><h2 className="truncate font-bold text-slate-950">{name}</h2><p className="mt-1 text-xs capitalize text-slate-500">{member.role}</p></div></div><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs"><span className={member.is_active ? "font-bold text-emerald-700" : "font-bold text-slate-400"}>{member.is_active ? "Active" : "Inactive"}</span><span className="text-slate-400">Joined {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(member.created_at))}</span></div></article>; })}</div> : <EmptyState title="Team member ma jiro" description="Agents-ka agency-ga waxay halkan kasoo muuqan doonaan." />}
        </section>
      </div>
    </AppShell>
  );
}

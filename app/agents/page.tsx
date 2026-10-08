import { logout } from "@/app/(auth)/actions";
import { inviteAgencyMember, setAvailability, setMemberAvailability } from "@/app/agents/actions";
import { CopyInviteLink } from "@/components/agents/copy-invite-link";
import { AuthMessage } from "@/components/auth/auth-message";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; invite?: string }> }) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const query = await searchParams;
  const { data: members } = await supabase.from("agency_members").select("id, user_id, role, is_active, availability, created_at").eq("agency_id", agency.id).order("created_at");
  const ids = members?.map((member) => member.user_id) ?? [];
  const { data: profiles } = ids.length ? await supabase.from("user_profiles").select("id, full_name, phone").in("id", ids) : { data: [] };
  const profileById = new Map(profiles?.map((profile) => [profile.id, profile]));
  const canManageAvailability = ["owner", "admin", "manager"].includes(membership.role);
  const availabilityOptions = [
    ["available", "Diyaar"],
    ["online", "Online"],
    ["busy", "Mashquul"],
    ["away", "Maqan"],
    ["offline", "Offline"],
  ];

  return (
    <AppShell agencyName={agency.name} currentPath="/agents" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeading eyebrow="Team" title="Agents" description="Dadka ka shaqeeya workspace-kan iyo roles-kooda." action={<span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">{members?.length ?? 0} members</span>} />
        <AuthMessage error={query.error} message={query.message} />
        {query.invite ? <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div><h2 className="font-bold text-emerald-950">Invite link waa diyaar</h2><p className="mt-1 text-sm text-emerald-800">Link-gu 7 maalmood ayuu shaqaynayaa, hal qof oo email-kiisa la casuumay keliya ayaana isticmaali kara.</p></div><CopyInviteLink path={`/join/${query.invite}`} /></section> : null}
        <section className="grid gap-5 lg:grid-cols-2">
          {membership.role === "owner" ? <form action={inviteAgencyMember} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-black">Casuumi team member</h2><p className="mt-1 text-sm text-slate-500">Samee link ammaan ah oo aad qofka la wadaagto.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Email<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" name="email" required type="email" /></label><label className="text-sm font-bold text-slate-700">Role<select className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" name="role" defaultValue="agent"><option value="admin">Admin</option><option value="manager">Manager</option><option value="agent">Agent</option><option value="receptionist">Receptionist</option></select></label></div><button className="mt-5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black" type="submit">Samee invite link</button></form> : null}
          <form action={setAvailability} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-black">Availability-gaaga</h2><p className="mt-1 text-sm text-slate-500">Sheeg haddii aad diyaar u tahay human handoff.</p><select className="mt-5 w-full rounded-xl border border-slate-300 px-3 py-2.5" name="availability" defaultValue={members?.find((item) => item.user_id === user.id)?.availability ?? "offline"}>{availabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" type="submit">Kaydi availability</button></form>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {members?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{members.map((member) => { const profile = profileById.get(member.user_id); const name = profile?.full_name || (member.user_id === user.id ? user.email : "Agency member"); return <article className="rounded-2xl border border-slate-200 p-5" key={member.id}><div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 font-bold text-emerald-800">{String(name).slice(0, 2).toUpperCase()}</div><div className="min-w-0"><h2 className="truncate font-bold text-slate-950">{name}</h2><p className="mt-1 text-xs capitalize text-slate-500">{member.role}</p></div></div><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs"><span className={member.is_active ? "font-bold text-emerald-700" : "font-bold text-slate-400"}>{member.is_active ? "Active" : "Inactive"}</span><span className="capitalize text-slate-500">● {member.availability}</span></div>{canManageAvailability ? <form action={setMemberAvailability} className="mt-4 flex gap-2"><input name="member_id" type="hidden" value={member.id} /><select aria-label={`${name} availability`} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" defaultValue={member.availability} name="availability">{availabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white" type="submit">Kaydi</button></form> : null}</article>; })}</div> : <EmptyState title="Team member ma jiro" description="Agents-ka agency-ga waxay halkan kasoo muuqan doonaan." />}
        </section>
      </div>
    </AppShell>
  );
}

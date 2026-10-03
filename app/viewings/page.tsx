import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

const colors: Record<string, string> = { requested: "bg-sky-100 text-sky-800", confirmed: "bg-emerald-100 text-emerald-800", completed: "bg-violet-100 text-violet-800", cancelled: "bg-slate-100 text-slate-600", no_show: "bg-rose-100 text-rose-800" };

export default async function ViewingsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; status?: string }> }) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const params = await searchParams;
  let query = supabase.from("viewings").select("id, lead_id, property_id, agent_id, starts_at, status, notes").eq("agency_id", agency.id).order("starts_at");
  if (params.status && Object.hasOwn(colors, params.status)) query = query.eq("status", params.status);
  const { data: viewings } = await query;
  const leadIds = [...new Set(viewings?.map((item) => item.lead_id) ?? [])];
  const propertyIds = [...new Set(viewings?.map((item) => item.property_id) ?? [])];
  const [{ data: leads }, { data: properties }] = await Promise.all([
    leadIds.length ? supabase.from("leads").select("id, name, phone").in("id", leadIds) : Promise.resolve({ data: [] }),
    propertyIds.length ? supabase.from("properties").select("id, title, district").in("id", propertyIds) : Promise.resolve({ data: [] }),
  ]);
  const leadMap = new Map(leads?.map((item) => [item.id, item.name || item.phone || "Lead aan magac lahayn"]));
  const propertyMap = new Map(properties?.map((item) => [item.id, `${item.title} · ${item.district}`]));
  const canCreate = ["owner", "admin", "manager", "agent", "receptionist"].includes(membership.role);
  return <AppShell agencyName={agency.name} currentPath="/viewings" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-7xl space-y-7">
    <PageHeading eyebrow="Appointments" title="Viewings" description="Qorshee, xaqiiji oo la soco booqashooyinka properties-ka." action={canCreate ? <Link className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" href="/viewings/new">+ Viewing cusub</Link> : null} />
    <AuthMessage error={params.error} message={params.message} />
    <div className="flex flex-wrap gap-2"><Link className="rounded-full border bg-white px-3 py-1.5 text-xs font-bold" href="/viewings">Dhammaan</Link>{Object.keys(colors).map((status) => <Link className={`rounded-full px-3 py-1.5 text-xs font-bold ${params.status === status ? "bg-slate-950 text-white" : colors[status]}`} href={`/viewings?status=${status}`} key={status}>{status}</Link>)}</div>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">{viewings?.length ? <div className="divide-y divide-slate-100">{viewings.map((viewing) => <Link className="grid gap-3 p-5 transition hover:bg-slate-50 sm:grid-cols-[1fr_1fr_auto] sm:items-center" href={`/viewings/${viewing.id}`} key={viewing.id}><div><p className="font-bold text-slate-950">{leadMap.get(viewing.lead_id)}</p><p className="mt-1 text-xs text-slate-500">{propertyMap.get(viewing.property_id)}</p></div><div><p className="text-sm font-semibold text-slate-800">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(viewing.starts_at))}</p><p className="mt-1 text-xs text-slate-400">{viewing.agent_id ? "Agent assigned" : "Agent lama xilsaarin"}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${colors[viewing.status]}`}>{viewing.status}</span></Link>)}</div> : <div className="p-6"><EmptyState title="Viewing ma jiro" description="Guji ‘Viewing cusub’ ama customer-ku ha codsado viewing widget-ka." /></div>}</section>
  </div></AppShell>;
}

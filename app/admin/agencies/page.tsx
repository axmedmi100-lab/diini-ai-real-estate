import Link from "next/link";
import { createAgency } from "@/app/admin/agencies/actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthMessage } from "@/components/auth/auth-message";
import { PageHeading } from "@/components/dashboard/page-heading";
import { getPlatformAdmin } from "@/lib/platform-admin";

export default async function AdminAgenciesPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; q?: string; status?: string }> }) {
  const { user, supabase } = await getPlatformAdmin(); const params = await searchParams;
  let query = supabase.from("agencies").select("id,name,slug,email,lifecycle_status,plan_code,trial_ends_at,created_at").order("created_at", { ascending: false });
  if (params.q) query = query.or(`name.ilike.%${params.q}%,slug.ilike.%${params.q}%,email.ilike.%${params.q}%`);
  if (params.status && ["trial","active","suspended","archived"].includes(params.status)) query = query.eq("lifecycle_status", params.status);
  const { data: agencies } = await query;
  const { data: planRows } = await supabase.from("platform_plans").select("code,name").eq("is_active", true).order("sort_order");
  return <AdminShell currentPath="/admin/agencies" userEmail={user.email}><div className="mx-auto max-w-7xl space-y-7">
    <PageHeading eyebrow="Tenant management" title="Agencies" description="Abuur, raadi, eeg oo maamul lifecycle-ka tenant kasta." /><AuthMessage error={params.error} message={params.message} />
    <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer font-bold">+ Abuur agency cusub</summary><form action={createAgency} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5"><input className="rounded-xl border px-3 py-2" name="name" placeholder="Agency name" required /><input className="rounded-xl border px-3 py-2" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="agency-slug" required /><input className="rounded-xl border px-3 py-2" name="email" placeholder="Contact email" type="email" /><select className="rounded-xl border px-3 py-2" name="plan_code">{planRows?.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select><select className="rounded-xl border px-3 py-2" name="lifecycle_status"><option value="trial">Trial</option><option value="active">Active</option></select><button className="rounded-xl bg-slate-950 px-4 py-2 font-bold text-white md:col-span-2 xl:col-span-5">Abuur agency</button></form></details>
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_12rem_auto]"><input className="rounded-xl border px-3 py-2" defaultValue={params.q} name="q" placeholder="Raadi name, slug ama email" /><select className="rounded-xl border px-3 py-2" defaultValue={params.status} name="status"><option value="">All statuses</option>{["trial","active","suspended","archived"].map(s=><option key={s}>{s}</option>)}</select><button className="rounded-xl bg-emerald-500 px-5 py-2 font-bold">Raadi</button></form>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{agencies?.length ? <div className="divide-y divide-slate-100">{agencies.map(a=><Link className="grid gap-3 p-5 hover:bg-slate-50 lg:grid-cols-[1fr_auto] lg:items-center" href={`/admin/agencies/${a.id}`} key={a.id}><div><h2 className="font-bold">{a.name}</h2><p className="mt-1 text-xs text-slate-500">{a.slug} · {a.email || "Email ma jiro"} · {new Date(a.created_at).toLocaleDateString()}</p></div><div className="flex gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{a.lifecycle_status}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{a.plan_code}</span></div></Link>)}</div>:<p className="p-8 text-sm text-slate-500">Agency lama helin.</p>}</section>
  </div></AdminShell>;
}

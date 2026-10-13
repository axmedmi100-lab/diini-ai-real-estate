import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; message?: string }> }) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const params = await searchParams;
  let request = supabase.from("customers").select("id,name,phone,email,preferred_language,follow_up_opted_out,created_at").eq("agency_id", agency.id).order("updated_at", { ascending: false });
  if (params.q?.trim()) {
    const safe = params.q.trim().replace(/[,%()]/g, "");
    request = request.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const { data: customers } = await request;
  void membership;
  return <AppShell agencyName={agency.name} currentPath="/customers" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-7xl space-y-7">
    <PageHeading eyebrow="CRM" title="Customers" description="Customer waa qof buy, rent, reserve ama deposit ku sameeyey property." action={<span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-sm">{customers?.length ?? 0} customers</span>} />
    <AuthMessage error={params.error} message={params.message} />
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Qof cusub marka hore Lead ahaan u geli. Markaad property transaction ka diiwaangeliso bogga Lead-ka, si otomaatig ah Customer ayuu noqonayaa.</div>
    <form className="flex gap-3 rounded-2xl border bg-white p-4"><input className="min-w-0 flex-1 rounded-xl border px-4 py-3" defaultValue={params.q} name="q" placeholder="Raadi magac, phone ama email..." /><button className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Raadi</button></form>
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">{customers?.length ? <div className="divide-y">{customers.map(customer => <Link className="grid gap-3 p-5 hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center" href={`/customers/${customer.id}`} key={customer.id}><div className="min-w-0"><h2 className="truncate font-bold">{customer.name || customer.phone || customer.email || "Customer"}</h2><p className="mt-1 truncate text-sm text-slate-500">{customer.phone || "Phone ma jiro"} · {customer.email || "Email ma jiro"}</p></div><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-slate-100 px-3 py-1 uppercase">{customer.preferred_language}</span><span className={`rounded-full px-3 py-1 ${customer.follow_up_opted_out ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{customer.follow_up_opted_out ? "Opted out" : "Follow-up allowed"}</span></div></Link>)}</div> : <div className="p-6"><EmptyState title="Customer ma jiro" description="Lead-ku wuxuu Customer noqonayaa marka buy, rent, reserve ama deposit property laga diiwaangeliyo." /></div>}</section>
  </div></AppShell>;
}


import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

type RelatedRow = { name?: string | null; phone?: string | null; title?: string | null; currency?: string | null };
const one = (value: RelatedRow | RelatedRow[] | null) => Array.isArray(value) ? value[0] ?? null : value;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const { supabase, user, agency } = await getAgencyWorkspace();
  const { data } = await supabase.from("property_transactions")
    .select("id,customer_id,property_id,transaction_type,total_price,deposit,remaining_balance,transaction_date,status,customers(name,phone),properties(title,currency)")
    .eq("agency_id", agency.id)
    .order("transaction_date", { ascending: false });
  const query = params.q?.trim().toLocaleLowerCase() || "";
  const status = new Set(["pending", "completed", "cancelled"]).has(params.status || "") ? params.status : "all";
  const transactions = (data ?? []).filter((item) => {
    const customer = one(item.customers as RelatedRow | RelatedRow[] | null);
    const property = one(item.properties as RelatedRow | RelatedRow[] | null);
    const matchesQuery = !query || [customer?.name, customer?.phone, property?.title].some((value) => value?.toLocaleLowerCase().includes(query));
    return matchesQuery && (status === "all" || item.status === status);
  });
  const totals = transactions.reduce((sum, item) => ({
    revenue: sum.revenue + (item.status === "completed" ? Number(item.total_price) : 0),
    paid: sum.paid + (item.status !== "cancelled" ? Number(item.deposit) : 0),
    remaining: sum.remaining + (item.status === "pending" ? Number(item.remaining_balance) : 0),
  }), { revenue: 0, paid: 0, remaining: 0 });

  return <AppShell agencyName={agency.name} currentPath="/transactions" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-7xl space-y-7">
    <PageHeading eyebrow="Finance & sales" title="Transactions" description="La soco deals-ka, lacagaha la bixiyey iyo balances-ka harsan." action={<span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-sm">{transactions.length} deals</span>} />
    <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Completed revenue</p><p className="mt-3 text-3xl font-black">USD {totals.revenue.toLocaleString()}</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Collected — active deals</p><p className="mt-3 text-3xl font-black text-emerald-700">USD {totals.paid.toLocaleString()}</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Outstanding — pending only</p><p className="mt-3 text-3xl font-black text-amber-700">USD {totals.remaining.toLocaleString()}</p></article></section>
    <form className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_12rem_auto]"><input className="rounded-xl border px-4 py-3" defaultValue={params.q} name="q" placeholder="Raadi customer, phone ama property..." /><select className="rounded-xl border px-4 py-3" defaultValue={status} name="status"><option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Filter</button></form>
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">{transactions.length ? <div className="divide-y">{transactions.map((item) => { const customer = one(item.customers as RelatedRow | RelatedRow[] | null); const property = one(item.properties as RelatedRow | RelatedRow[] | null); const currency = property?.currency || "USD"; return <Link className="grid gap-4 p-5 hover:bg-slate-50 lg:grid-cols-[1.3fr_1fr_.7fr_.7fr_auto] lg:items-center" href={`/transactions/${item.id}`} key={item.id}><div><p className="font-black">{property?.title || "Property"}</p><p className="mt-1 text-sm text-slate-500">{customer?.name || customer?.phone || "Customer"} · <span className="capitalize">{item.transaction_type}</span></p></div><div className="text-sm"><span className="text-slate-500">Date</span><p className="font-bold">{item.transaction_date}</p></div><div className="text-sm"><span className="text-slate-500">Paid</span><p className="font-bold">{currency} {Number(item.deposit).toLocaleString()}</p></div><div className="text-sm"><span className="text-slate-500">Remaining</span><p className="font-bold">{currency} {Number(item.remaining_balance).toLocaleString()}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold capitalize ${item.status === "completed" ? "bg-emerald-100 text-emerald-800" : item.status === "cancelled" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{item.status}</span></Link>})}</div> : <div className="p-6"><EmptyState title="Transaction lama helin" description="Beddel filter-ka ama lead ka samee property transaction cusub." /></div>}</section>
  </div></AppShell>;
}


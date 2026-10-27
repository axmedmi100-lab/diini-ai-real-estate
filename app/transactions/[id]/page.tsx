import Link from "next/link";
import { notFound } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { updatePropertyTransaction } from "@/app/customers/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

type Row = { name?: string | null; phone?: string | null; title?: string | null; currency?: string | null };
const one = (value: Row | Row[] | null) => Array.isArray(value) ? value[0] ?? null : value;

export default async function TransactionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { id } = await params;
  const notice = await searchParams;
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const { data: transaction } = await supabase.from("property_transactions").select("id,customer_id,property_id,transaction_type,total_price,deposit,remaining_balance,transaction_date,status,assigned_agent_id,notes,customers(name,phone),properties(title,currency)").eq("id", id).eq("agency_id", agency.id).maybeSingle();
  if (!transaction) notFound();
  const customer = one(transaction.customers as Row | Row[] | null);
  const property = one(transaction.properties as Row | Row[] | null);
  const currency = property?.currency || "USD";
  const canManage = new Set(["owner", "admin", "manager", "agent"]).has(membership.role);
  return <AppShell agencyName={agency.name} currentPath="/transactions" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-4xl space-y-6">
    <Link className="text-sm font-bold text-slate-600" href="/transactions">← Transactions</Link>
    <div><p className="text-xs font-bold uppercase text-emerald-700">Transaction detail</p><h1 className="mt-2 text-3xl font-black">{property?.title || "Property deal"}</h1><p className="mt-2 text-slate-500">{customer?.name || customer?.phone || "Customer"} · <span className="capitalize">{transaction.transaction_type}</span></p></div>
    <AuthMessage error={notice.error} message={notice.message} />
    <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Total</p><p className="mt-2 text-2xl font-black">{currency} {Number(transaction.total_price).toLocaleString()}</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Paid</p><p className="mt-2 text-2xl font-black text-emerald-700">{currency} {Number(transaction.deposit).toLocaleString()}</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Remaining</p><p className="mt-2 text-2xl font-black text-amber-700">{currency} {Number(transaction.remaining_balance).toLocaleString()}</p></article></section>
    <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Deal details</h2><p className="mt-1 text-sm text-slate-500">Transaction date: {transaction.transaction_date}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{transaction.status}</span></div><div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-xl border px-4 py-2.5 text-sm font-bold" href={`/customers/${transaction.customer_id}`}>Customer profile</Link><Link className="rounded-xl border px-4 py-2.5 text-sm font-bold" href={`/properties/${transaction.property_id}`}>Property details</Link></div>
      {canManage ? <form action={updatePropertyTransaction} className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2"><input name="customer_id" type="hidden" value={transaction.customer_id} /><input name="transaction_id" type="hidden" value={transaction.id} /><input name="return_to" type="hidden" value={`/transactions/${transaction.id}`} /><label className="text-sm font-bold">Lacagta la bixiyey<input className="mt-2 w-full rounded-xl border px-3 py-2.5" defaultValue={Number(transaction.deposit)} max={Number(transaction.total_price)} min="0" name="deposit" required step="0.01" type="number" /></label><label className="text-sm font-bold">Status<select className="mt-2 w-full rounded-xl border px-3 py-2.5" defaultValue={transaction.status} name="status"><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label className="text-sm font-bold sm:col-span-2">Notes<textarea className="mt-2 w-full rounded-xl border px-3 py-2.5" defaultValue={transaction.notes ?? ""} name="transaction_notes" rows={4} /></label><div className="sm:col-span-2"><button className="rounded-xl bg-emerald-500 px-5 py-3 font-black">Kaydi transaction-ka</button><p className="mt-2 text-xs text-slate-500">Completed waxay u baahan tahay in lacagta la bixiyey la mid noqoto total-ka.</p></div></form> : null}
    </section>
  </div></AppShell>;
}


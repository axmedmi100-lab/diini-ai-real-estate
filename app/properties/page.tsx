import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const messages = await searchParams;
  const { data: properties } = await supabase.from("properties").select("id, title, property_type, purpose, district, price, currency, bedrooms, bathrooms, status, image_urls, created_at").eq("agency_id", agency.id).order("created_at", { ascending: false });
  const money = (value: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  const canCreate = ["owner", "admin", "manager", "agent"].includes(membership.role);

  return (
    <AppShell agencyName={agency.name} currentPath="/properties" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeading eyebrow="Inventory" title="Properties" description="Dhammaan guryaha iyo listings-ka ay agency-gu maamusho." action={canCreate ? <Link className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800" href="/properties/new">+ Property cusub</Link> : null} />
        <AuthMessage error={messages.error} message={messages.message} />
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {properties?.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{properties.map((property) => { const images = Array.isArray(property.image_urls) ? property.image_urls as string[] : []; return <Link className="group overflow-hidden rounded-2xl border border-slate-200 transition hover:-translate-y-0.5 hover:shadow-md" href={`/properties/${property.id}`} key={property.id}><div className="flex h-44 items-center justify-center bg-gradient-to-br from-emerald-100 via-slate-50 to-sky-100 bg-cover bg-center text-4xl" style={images[0] ? { backgroundImage: `url(${images[0]})` } : undefined}>{images[0] ? null : "⌂"}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold capitalize text-emerald-700">{property.purpose} · {property.property_type}</p><h2 className="mt-1 font-bold text-slate-950 group-hover:text-emerald-700">{property.title}</h2></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold capitalize text-slate-600">{property.status}</span></div><p className="mt-3 text-sm text-slate-500">{property.district} · {property.bedrooms ?? 0} bed · {property.bathrooms ?? 0} bath</p><p className="mt-4 text-xl font-bold text-slate-950">{money(Number(property.price), property.currency)}</p></div></Link>; })}</div> : <EmptyState title="Weli property lama gelin" description="Guji ‘Property cusub’ si aad u abuurto listing-kaaga ugu horreeya." />}
        </section>
      </div>
    </AppShell>
  );
}

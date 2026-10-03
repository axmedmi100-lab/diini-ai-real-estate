import Link from "next/link";
import { notFound } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { deleteProperty } from "@/app/properties/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { AppShell } from "@/components/layout/app-shell";
import { DeletePropertyButton } from "@/components/properties/delete-property-button";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function PropertyDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { id } = await params;
  const messages = await searchParams;
  const { supabase, user, membership, agency } = await getAgencyWorkspace();
  const { data: property } = await supabase.from("properties").select("*").eq("id", id).eq("agency_id", agency.id).maybeSingle();
  if (!property) notFound();
  const images = Array.isArray(property.image_urls) ? property.image_urls as string[] : [];
  const features = Array.isArray(property.features) ? property.features as string[] : [];
  const canEdit = ["owner", "admin", "manager", "agent"].includes(membership.role);
  const canDelete = ["owner", "admin", "manager"].includes(membership.role);
  const money = new Intl.NumberFormat("en", { style: "currency", currency: property.currency, maximumFractionDigits: 0 }).format(Number(property.price));

  return (
    <AppShell agencyName={agency.name} currentPath="/properties" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link className="text-sm font-bold text-slate-600" href="/properties">← Properties</Link><div className="flex items-center gap-2">{canEdit ? <Link className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" href={`/properties/${id}/edit`}>Edit</Link> : null}{canDelete ? <DeletePropertyButton action={deleteProperty} propertyId={id} /> : null}</div></div>
        <AuthMessage error={messages.error} message={messages.message} />
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {images.length ? <div className="grid h-80 gap-1 sm:grid-cols-2"><div className="bg-cover bg-center" style={{ backgroundImage: `url(${images[0]})` }} />{images[1] ? <div className="bg-cover bg-center" style={{ backgroundImage: `url(${images[1]})` }} /> : <div className="bg-slate-100" />}</div> : <div className="flex h-64 items-center justify-center bg-gradient-to-br from-emerald-100 via-slate-50 to-sky-100 text-6xl">⌂</div>}
          <div className="p-6 sm:p-9"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold tracking-wide text-emerald-700 uppercase">{property.purpose} · {property.property_type}</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{property.title}</h1><p className="mt-2 text-sm text-slate-500">{property.address || property.district}</p></div><div className="sm:text-right"><p className="text-3xl font-bold text-slate-950">{money}</p><span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold capitalize text-emerald-800">{property.status}</span></div></div>
            <div className="mt-8 grid gap-3 sm:grid-cols-4">{[["Bedrooms", property.bedrooms ?? "—"], ["Bathrooms", property.bathrooms ?? "—"], ["Area", property.area ? `${property.area} m²` : "—"], ["Furnished", property.furnished ? "Haa" : "Maya"]].map(([label, value]) => <div className="rounded-2xl bg-slate-50 p-4" key={String(label)}><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>)}</div>
            {property.description ? <div className="mt-8"><h2 className="font-bold text-slate-950">Sharaxaad</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{property.description}</p></div> : null}
            {features.length ? <div className="mt-8"><h2 className="font-bold text-slate-950">Features</h2><div className="mt-3 flex flex-wrap gap-2">{features.map((feature) => <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600" key={feature}>{feature}</span>)}</div></div> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

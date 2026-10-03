import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { createProperty } from "@/app/properties/actions";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { PropertyForm } from "@/components/properties/property-form";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function NewPropertyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, membership, agency } = await getAgencyWorkspace();
  const { error } = await searchParams;
  if (!["owner", "admin", "manager", "agent"].includes(membership.role)) return null;
  return <AppShell agencyName={agency.name} currentPath="/properties" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-4xl space-y-8"><PageHeading eyebrow="Property CRUD" title="Property cusub" description="Geli xogta saxda ah iyo sawirrada property-ga." action={<Link className="text-sm font-bold text-slate-600" href="/properties">← Dib u noqo</Link>} /><PropertyForm action={createProperty} error={error} /></div></AppShell>;
}

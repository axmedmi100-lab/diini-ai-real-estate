import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getAgencyWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("agency_members")
    .select("id, agency_id, role, agencies(*)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !membership) redirect("/login?error=Agency workspace-ka lama helin.");

  const relation = membership.agencies as Record<string, unknown> | Record<string, unknown>[] | null;
  const agency = (Array.isArray(relation) ? relation[0] : relation) as {
    id: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    country_code: string;
    timezone: string;
    default_language: string;
    default_currency: string;
  } | null;

  if (!agency) redirect("/login?error=Agency workspace-ka lama helin.");

  return { supabase, user, membership, agency };
}

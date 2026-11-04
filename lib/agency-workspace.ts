import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const ACTIVE_AGENCY_COOKIE = "diini_active_agency";

export async function getAgencyWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const selectedAgencyId = (await cookies()).get(ACTIVE_AGENCY_COOKIE)?.value;

  let membershipQuery = supabase
    .from("agency_members")
    .select("id, agency_id, role, agencies(*)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (selectedAgencyId && /^[0-9a-f-]{36}$/i.test(selectedAgencyId)) {
    membershipQuery = membershipQuery.eq("agency_id", selectedAgencyId);
  }

  let { data: membership, error } = await membershipQuery
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // A deleted, suspended or otherwise stale selection must never lock the user
  // out. Fall back to their first active membership after validating the cookie.
  if (!membership && selectedAgencyId) {
    const fallback = await supabase
      .from("agency_members")
      .select("id, agency_id, role, agencies(*)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    membership = fallback.data;
    error = fallback.error;
  }

  if (error || !membership) {
    const { data: isPlatformAdmin } = await supabase.rpc("is_platform_super_admin");
    if (isPlatformAdmin) redirect("/admin");
    redirect("/login?error=Agency workspace-ka lama helin.");
  }

  const relation = membership.agencies as Record<string, unknown> | Record<string, unknown>[] | null;
  const agency = (Array.isArray(relation) ? relation[0] : relation) as {
    id: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    logo_url: string | null;
    country_code: string;
    timezone: string;
    default_language: string;
    default_currency: string;
    plan_code: "starter" | "pro" | "enterprise";
    lifecycle_status: "trial" | "active" | "suspended" | "archived";
  } | null;

  if (!agency) redirect("/login?error=Agency workspace-ka lama helin.");
  if (agency.lifecycle_status === "suspended" || agency.lifecycle_status === "archived") {
    redirect(`/login?error=${encodeURIComponent("Agency account-kan waa la hakiyey. La xiriir DIINI support.")}`);
  }

  return { supabase, user, membership, agency };
}


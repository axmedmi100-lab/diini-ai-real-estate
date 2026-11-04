"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const statuses = new Set(["trial", "active", "suspended", "archived"]);
const plans = new Set(["starter", "pro", "enterprise"]);

export async function createAgency(formData: FormData) {
  const { supabase } = await getPlatformAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const planCode = String(formData.get("plan_code") ?? "starter");
  const lifecycleStatus = String(formData.get("lifecycle_status") ?? "trial");
  if (name.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !plans.has(planCode) || !statuses.has(lifecycleStatus)) redirect("/admin/agencies?error=Xogta agency-ga ama owner email-ka sax ma aha.");
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await supabase.rpc("platform_create_agency_with_owner_invite", { agency_name: name, agency_slug: slug, owner_email: email, agency_plan: planCode, agency_status: lifecycleStatus, raw_token: token });
  if (error || !data) redirect("/admin/agencies?error=Agency-ga lama abuurin. Hubi slug-ga inuusan jirin.");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const { error: emailError } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
    data: { invitation_token: token, preferred_language: "so" },
  });
  revalidatePath("/admin"); revalidatePath("/admin/agencies");
  const message = emailError
    ? "Agency-ga waa la abuuray. Email-kan account hore ayuu leeyahay ama email delivery-ga ayaa fashilmay; owner invite link-ga hoose gacanta ula wadaag."
    : "Agency-ga waa la abuuray, owner invitation email-kana waa la diray.";
  redirect(`/admin/agencies/${data}?message=${encodeURIComponent(message)}&invite=${encodeURIComponent(token)}`);
}

export async function updateAgencyLifecycle(formData: FormData) {
  const { supabase } = await getPlatformAdmin();
  const agencyId = String(formData.get("agency_id") ?? "");
  const lifecycleStatus = String(formData.get("lifecycle_status") ?? "");
  const planCode = String(formData.get("plan_code") ?? "");
  if (!agencyId || !statuses.has(lifecycleStatus) || !plans.has(planCode)) redirect("/admin/agencies?error=Xogta agency-ga sax ma aha.");
  const { error } = await supabase.rpc("platform_update_agency", { target_agency_id: agencyId, new_lifecycle_status: lifecycleStatus, new_plan_code: planCode });
  if (error) redirect(`/admin/agencies/${agencyId}?error=Agency-ga lama cusboonaysiin.`);
  revalidatePath("/admin"); revalidatePath("/admin/agencies");
  revalidatePath(`/admin/agencies/${agencyId}`);
  redirect(`/admin/agencies/${agencyId}?message=Agency-ga waa la cusboonaysiiyey.`);
}


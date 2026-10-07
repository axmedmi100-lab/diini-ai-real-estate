"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPlatformAdmin } from "@/lib/platform-admin";

const statuses = new Set(["trial", "active", "suspended", "archived"]);
const plans = new Set(["starter", "pro", "enterprise"]);

export async function createAgency(formData: FormData) {
  const { supabase } = await getPlatformAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const planCode = String(formData.get("plan_code") ?? "starter");
  const lifecycleStatus = String(formData.get("lifecycle_status") ?? "trial");
  if (name.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !plans.has(planCode) || !statuses.has(lifecycleStatus)) redirect("/admin/agencies?error=Xogta agency-ga cusub sax ma aha.");
  const { data, error } = await supabase.rpc("platform_create_agency", { agency_name: name, agency_slug: slug, agency_email: email, agency_plan: planCode, agency_status: lifecycleStatus });
  if (error || !data) redirect("/admin/agencies?error=Agency-ga lama abuurin. Hubi slug-ga inuusan jirin.");
  revalidatePath("/admin"); revalidatePath("/admin/agencies");
  redirect(`/admin/agencies/${data}?message=Agency-ga waa la abuuray. Owner invitation wali si gaar ah ayaa loo dirayaa.`);
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPlatformAdmin } from "@/lib/platform-admin";

const statuses = new Set(["trial", "active", "suspended", "archived"]);
const plans = new Set(["starter", "pro", "enterprise"]);

export async function updateAgencyLifecycle(formData: FormData) {
  const { supabase } = await getPlatformAdmin();
  const agencyId = String(formData.get("agency_id") ?? "");
  const lifecycleStatus = String(formData.get("lifecycle_status") ?? "");
  const planCode = String(formData.get("plan_code") ?? "");
  if (!agencyId || !statuses.has(lifecycleStatus) || !plans.has(planCode)) redirect("/admin/agencies?error=Xogta agency-ga sax ma aha.");
  const { error } = await supabase.rpc("platform_update_agency", { target_agency_id: agencyId, new_lifecycle_status: lifecycleStatus, new_plan_code: planCode });
  if (error) redirect("/admin/agencies?error=Agency-ga lama cusboonaysiin.");
  revalidatePath("/admin"); revalidatePath("/admin/agencies");
  redirect("/admin/agencies?message=Agency-ga waa la cusboonaysiiyey.");
}

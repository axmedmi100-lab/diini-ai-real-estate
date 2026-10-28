"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-admin";

export async function reviewManualPayment(formData: FormData) {
  const { supabase } = await getPlatformAdmin();
  const requestId = String(formData.get("request_id") ?? "");
  const approve = String(formData.get("decision") ?? "") === "approve";
  const rejectionReason = String(formData.get("rejection_reason") ?? "").trim();
  const periodMonths = Number(formData.get("period_months") ?? 1);
  const { error } = await supabase.rpc("platform_review_manual_payment", {
    target_request_id: requestId,
    approve_request: approve,
    target_rejection_reason: rejectionReason || null,
    target_period_months: periodMonths,
  });
  if (error) redirect(`/admin/billing?error=${encodeURIComponent("Codsiga lama go'aamin: " + error.message)}`);
  revalidatePath("/admin/billing");
  revalidatePath("/billing");
  redirect(`/admin/billing?message=${encodeURIComponent(approve ? "Lacag-bixinta waa la ansixiyey; plan-kuna waa shaqaynayaa." : "Codsiga waa la diiday.")}`);
}


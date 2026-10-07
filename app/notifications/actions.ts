"use server";

import { revalidatePath } from "next/cache";

import { getAgencyWorkspace } from "@/lib/agency-workspace";

export async function markNotificationRead(formData: FormData) {
  const { supabase, agency } = await getAgencyWorkspace();
  const id = String(formData.get("notification_id") ?? "");
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("agency_id", agency.id);
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const { supabase, agency } = await getAgencyWorkspace();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("agency_id", agency.id).is("read_at", null);
  revalidatePath("/notifications");
}

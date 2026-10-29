"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-admin";

export async function createExpense(formData: FormData) {
  const { supabase } = await getPlatformAdmin();
  const { error } = await supabase.rpc("platform_create_expense", {
    target_category: String(formData.get("category") ?? ""),
    target_description: String(formData.get("description") ?? "").trim(),
    target_vendor: String(formData.get("vendor") ?? "").trim(),
    target_amount: Number(formData.get("amount") ?? 0),
    target_expense_date: String(formData.get("expense_date") ?? ""),
    target_notes: String(formData.get("notes") ?? "").trim() || null,
    target_recurring: formData.get("recurring") === "on",
  });
  if (error) redirect(`/admin/expenses?error=${encodeURIComponent("Kharashka lama kaydin: " + error.message)}`);
  revalidatePath("/admin/expenses"); revalidatePath("/admin/revenue");
  redirect("/admin/expenses?message=Kharashka waa la kaydiyey.");
}

export async function deleteExpense(formData: FormData) {
  const { supabase } = await getPlatformAdmin();
  const { error } = await supabase.rpc("platform_delete_expense", { target_expense_id: String(formData.get("expense_id") ?? "") });
  if (error) redirect("/admin/expenses?error=Kharashka lama tirtiri karin.");
  revalidatePath("/admin/expenses"); revalidatePath("/admin/revenue");
  redirect("/admin/expenses?message=Kharashka waa la tirtiray.");
}


"use server";

import { redirect } from "next/navigation";

import { getPlatformAdmin } from "@/lib/platform-admin";

const modes = new Set(["managed", "byok", "hybrid"]);

function nullableLimit(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : NaN;
}

export async function updateProvider(formData: FormData) {
  const { supabase } = await getPlatformAdmin();
  const provider = String(formData.get("provider") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const limit = nullableLimit(formData.get("monthly_limit"));
  if (!/^[a-z0-9_]+$/.test(provider) || !modes.has(mode) || Number.isNaN(limit)) redirect("/admin/integrations?error=Xogta provider-ka sax ma aha.");
  const { error } = await supabase.rpc("platform_update_integration_provider", {
    target_provider: provider,
    target_enabled: formData.get("enabled") === "on",
    target_mode: mode,
    target_default_limit: limit,
  });
  if (error) redirect(`/admin/integrations?error=${encodeURIComponent("Provider-ka lama cusboonaysiin.")}`);
  redirect("/admin/integrations?message=Provider-ka waa la cusboonaysiiyey.");
}

export async function updateAgencyIntegration(formData: FormData) {
  const { supabase } = await getPlatformAdmin();
  const agencyId = String(formData.get("agency_id") ?? "");
  const provider = String(formData.get("provider") ?? "");
  const limit = nullableLimit(formData.get("monthly_limit"));
  if (!/^[0-9a-f-]{36}$/i.test(agencyId) || !/^[a-z0-9_]+$/.test(provider) || Number.isNaN(limit)) redirect("/admin/integrations?error=Xogta agency integration-ka sax ma aha.");
  const { error } = await supabase.rpc("platform_update_agency_integration", {
    target_agency_id: agencyId,
    target_provider: provider,
    target_enabled: formData.get("enabled") === "on",
    target_monthly_limit: limit,
  });
  if (error) redirect(`/admin/integrations?error=${encodeURIComponent("Agency integration-ka lama cusboonaysiin.")}`);
  redirect("/admin/integrations?message=Agency integration-ka waa la cusboonaysiiyey.");
}


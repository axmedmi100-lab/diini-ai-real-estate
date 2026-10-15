"use server";

import { redirect } from "next/navigation";
import OpenAI from "openai";

import { encryptIntegrationSecret } from "@/lib/security/integration-secret";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAIKey } from "@/lib/integrations/platform-credentials";

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

function secretHint(secret: string) {
  if (secret.length <= 8) return `••••${secret.slice(-2)}`;
  return `${secret.slice(0, 3)}••••••${secret.slice(-4)}`;
}

export async function saveProviderSecret(formData: FormData) {
  const { user } = await getPlatformAdmin();
  const provider = String(formData.get("provider") ?? "");
  const secret = String(formData.get("secret") ?? "").trim();
  if (!/^[a-z0-9_]+$/.test(provider) || secret.length < 12 || secret.length > 4096) {
    redirect("/admin/integrations?error=API secret-ku sax ma aha; ugu yaraan 12 xaraf geli.");
  }

  try {
    const admin = createAdminClient();
    const encrypted = encryptIntegrationSecret(secret);
    const { error: vaultError } = await admin.from("platform_integration_secrets").upsert(
      { provider, encrypted_value: encrypted },
      { onConflict: "provider" },
    );
    if (vaultError) throw vaultError;

    const { error: stateError } = await admin.from("platform_integration_providers")
      .update({ secret_configured: true, secret_hint: secretHint(secret) })
      .eq("provider", provider);
    if (stateError) throw stateError;

    await admin.from("platform_audit_logs").insert({
      actor_user_id: user.id,
      action: "integration_provider.secret_saved",
      metadata: { provider },
    });
  } catch {
    redirect("/admin/integrations?error=Secret-ka lama kaydin. Hubi migration-ka iyo INTEGRATION_ENCRYPTION_KEY.");
  }
  redirect("/admin/integrations?message=API secret-ka si encrypted ah ayaa loo kaydiyey.");
}

export async function removeProviderSecret(formData: FormData) {
  const { user } = await getPlatformAdmin();
  const provider = String(formData.get("provider") ?? "");
  if (!/^[a-z0-9_]+$/.test(provider)) redirect("/admin/integrations?error=Provider-ka sax ma aha.");

  const admin = createAdminClient();
  const { error } = await admin.from("platform_integration_secrets").delete().eq("provider", provider);
  if (error) redirect("/admin/integrations?error=Secret-ka lama saari karin.");
  await admin.from("platform_integration_providers").update({ secret_configured: false, secret_hint: null }).eq("provider", provider);
  await admin.from("platform_audit_logs").insert({ actor_user_id: user.id, action: "integration_provider.secret_removed", metadata: { provider } });
  redirect("/admin/integrations?message=API secret-ka waa laga saaray.");
}

export async function testProviderConnection(formData: FormData) {
  await getPlatformAdmin();
  const provider = String(formData.get("provider") ?? "");
  if (provider !== "openai") redirect("/admin/integrations?error=Connection test-kan hadda OpenAI keliya ayuu taageeraa.");

  const apiKey = await getOpenAIKey();
  if (!apiKey) redirect("/admin/integrations?error=OpenAI API key lama helin.");

  try {
    const client = new OpenAI({ apiKey });
    await client.models.list();
    redirect("/admin/integrations?message=OpenAI connection-ku waa sax; API key-ga waa la xaqiijiyey.");
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
    const message = status === 401
      ? "OpenAI ayaa diiday API key-ga (401). Key-gu wuu kaydsan yahay laakiin OpenAI uma aqoonsana credential sax ah; samee project API key cusub oo buuxa kadib Replace ku samee."
      : status === 429
        ? "OpenAI key-gu waa sax, laakiin quota/billing limit ayaa jira (429)."
        : status === 403
          ? "OpenAI key-gu waa sax, laakiin project-ka ama organization-ku ma oggola access-kan (403)."
          : `OpenAI connection test-ku wuu fashilmay${status ? ` (${status})` : ""}.`;
    redirect(`/admin/integrations?error=${encodeURIComponent(message)}`);
  }
}


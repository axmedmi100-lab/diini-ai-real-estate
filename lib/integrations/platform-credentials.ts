import { cache } from "react";

import { decryptIntegrationSecret } from "@/lib/security/integration-secret";
import { createAdminClient } from "@/lib/supabase/admin";

export const getPlatformIntegrationSecret = cache(async (provider: string) => {
  if (!/^[a-z0-9_]+$/.test(provider)) return null;

  const { data, error } = await createAdminClient()
    .from("platform_integration_secrets")
    .select("encrypted_value")
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data?.encrypted_value) return null;
  try {
    return decryptIntegrationSecret(data.encrypted_value);
  } catch {
    return null;
  }
});

export async function getOpenAIKey() {
  return (await getPlatformIntegrationSecret("openai")) || process.env.OPENAI_API_KEY || null;
}


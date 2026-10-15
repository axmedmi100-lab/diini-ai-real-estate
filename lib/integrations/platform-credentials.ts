import { decryptIntegrationSecret } from "@/lib/security/integration-secret";
import { createAdminClient } from "@/lib/supabase/admin";

// Provider credentials may be rotated from the admin UI. Always read the
// current encrypted value instead of retaining an old key in a warm runtime.
export async function getPlatformIntegrationSecret(provider: string) {
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
}

export async function getOpenAIKey() {
  const value = (await getPlatformIntegrationSecret("openai")) || process.env.OPENAI_API_KEY || null;
  if (!value) return null;
  return value.trim().replace(/^Bearer\s+/i, "").replace(/^['\"]|['\"]$/g, "");
}


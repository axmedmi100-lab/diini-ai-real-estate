import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";

export function createPublicClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

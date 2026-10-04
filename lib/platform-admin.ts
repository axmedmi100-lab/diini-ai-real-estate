import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getPlatformAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Fadlan marka hore gal account-kaaga.");

  const { data: allowed, error } = await supabase.rpc("is_platform_super_admin");
  if (error || !allowed) notFound();

  return { user, supabase };
}

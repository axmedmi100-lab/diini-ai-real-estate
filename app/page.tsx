import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_super_admin");
  redirect(isPlatformAdmin ? "/admin" : "/dashboard");
}

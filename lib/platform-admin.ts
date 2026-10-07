import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getPlatformAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Fadlan marka hore gal Super Admin account-kaaga.");

  const { data: allowed, error } = await supabase.rpc("is_platform_super_admin");
  if (error) {
    redirect(`/login?error=${encodeURIComponent("Super Admin authorization-ka lama xaqiijin. Hubi internet-ka kadibna mar kale gal.")}`);
  }
  if (!allowed) {
    const email = user.email ?? "account-kan";
    redirect(`/login?error=${encodeURIComponent(`${email} ma aha Super Admin. Ku gal axmedmi100@gmail.com si aad u furto maamulka platform-ka.`)}`);
  }

  return { user, supabase };
}

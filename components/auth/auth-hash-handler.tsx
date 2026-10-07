"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

export function AuthHashHandler() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const type = hash.get("type");

    if (!accessToken || !refreshToken) return;

    const finishAuthentication = async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

      if (error) {
        window.location.replace("/login?error=Link-ga gelitaanka ma shaqaynayo ama wuu dhacay.");
        return;
      }

      if (type === "invite" || type === "recovery") {
        window.sessionStorage.setItem("diini_password_setup", type);
        window.location.replace("/auth/set-password");
        return;
      }

      const { data: isPlatformAdmin } = await supabase.rpc("is_platform_super_admin");
      window.location.replace(isPlatformAdmin ? "/admin" : "/dashboard");
    };

    void finishAuthentication();
  }, []);

  return null;
}

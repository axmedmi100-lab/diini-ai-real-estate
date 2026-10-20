import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function publicUrl(pathname: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return new URL(pathname, `${origin}/`);
}

function redirectToLogin(request: NextRequest, message: string) {
  const destination = publicUrl("/login");
  destination.searchParams.set("error", message);
  return NextResponse.redirect(destination, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return redirectToLogin(request, "Email iyo password waa waajib.");
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.status === 0 || error.name === "AuthRetryableFetchError") {
      return redirectToLogin(request, "Supabase lama xiriiri karo hadda. Hubi internet-ka, kadibna mar kale isku day.");
    }
    if (error.code === "email_not_confirmed") {
      return redirectToLogin(request, "Email-kaaga weli lama xaqiijin. Fur fariinta Supabase ee email-kaaga ku timid, kadib guji link-ga xaqiijinta.");
    }
    if (error.code === "over_request_rate_limit") {
      return redirectToLogin(request, "Isku-dayo badan ayaa dhacay. Sug dhowr daqiiqo kadibna mar kale isku day.");
    }
    return redirectToLogin(request, "Email ama password-ka waa khalad.");
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_super_admin");
  if (!isPlatformAdmin && authData.user) {
    const { data: membership } = await supabase
      .from("agency_members")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      const agencyName = String(authData.user.user_metadata?.agency_name ?? "").trim();
      if (!agencyName) {
        return redirectToLogin(request, "Agency workspace-ka account-kan lama helin. La xiriir Super Admin-ka si agency loogu xiro.");
      }

      const slugBase = agencyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agency";
      const slug = `${slugBase}-${authData.user.id.replaceAll("-", "").slice(0, 8)}`;
      const { data: existingAgency } = await supabase
        .from("agencies")
        .select("id")
        .eq("created_by", authData.user.id)
        .limit(1)
        .maybeSingle();
      const agencyResult = existingAgency
        ? { data: existingAgency, error: null }
        : await supabase
            .from("agencies")
            .insert({ created_by: authData.user.id, name: agencyName, slug })
            .select("id")
            .single();
      const { data: agency, error: agencyError } = agencyResult;

      if (agencyError || !agency) {
        return redirectToLogin(request, "Agency workspace-ka lama diyaarin karin. Fadlan la xiriir Super Admin-ka.");
      }

      const { error: memberError } = await supabase
        .from("agency_members")
        .insert({ agency_id: agency.id, user_id: authData.user.id, role: "owner" });
      if (memberError) {
        return redirectToLogin(request, "Agency membership-ka lama diyaarin karin. Fadlan la xiriir Super Admin-ka.");
      }

      await supabase.from("ai_settings").insert({ agency_id: agency.id });
    }
  }
  const destination = publicUrl(isPlatformAdmin ? "/admin" : "/dashboard");
  return NextResponse.redirect(destination, 303);
}

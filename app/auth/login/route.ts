import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function redirectToLogin(request: NextRequest, message: string) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/login";
  destination.search = "";
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

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
  const destination = request.nextUrl.clone();
  destination.pathname = isPlatformAdmin ? "/admin" : "/dashboard";
  destination.search = "";
  return NextResponse.redirect(destination, 303);
}

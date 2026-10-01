import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const destination = request.nextUrl.clone();

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      destination.pathname = "/dashboard";
      destination.search = "";
      return NextResponse.redirect(destination);
    }
  }

  destination.pathname = "/login";
  destination.search = "";
  destination.searchParams.set("error", "Email confirmation link-ga ma shaqaynayo ama wuu dhacay.");
  return NextResponse.redirect(destination);
}

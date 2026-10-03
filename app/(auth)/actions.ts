"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function loginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

function signupError(message: string): never {
  redirect(`/signup?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");

  if (!email || !password) {
    loginError("Email iyo password waa waajib.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      loginError("Email-kaaga weli lama xaqiijin. Fur fariinta Supabase ee email-kaaga ku timid, kadib guji link-ga xaqiijinta.");
    }

    if (error.code === "over_request_rate_limit") {
      loginError("Isku-dayo badan ayaa dhacay. Sug dhowr daqiiqo kadibna mar kale isku day.");
    }

    loginError("Email ama password-ka waa khalad.");
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const fullName = value(formData, "full_name");
  const agencyName = value(formData, "agency_name");
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");

  if (!fullName || !agencyName || !email || !password) {
    signupError("Dhammaan meelaha waa waajib.");
  }

  if (password.length < 8) {
    signupError("Password-ku waa inuu ugu yaraan 8 xaraf ahaadaa.");
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: {
        full_name: fullName,
        agency_name: agencyName,
        preferred_language: "so",
      },
    },
  });

  if (error) {
    signupError("Account-ka lama samayn. Hubi email-ka ama isku day mar kale.");
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect("/login?message=Email-kaaga hubi si aad account-ka u xaqiijiso.");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?message=Waad ka baxday account-ka.");
}

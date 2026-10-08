"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }

export async function acceptExistingAccountInvite(formData: FormData) {
  const token = value(formData, "token");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?message=${encodeURIComponent("Marka hore gal account-ka email-ka la casuumay, kadib dib u fur invite link-ga.")}`);
  const { error } = await supabase.rpc("accept_agency_invitation", { raw_token: token });
  if (error) redirect(`/join/${token}?error=${encodeURIComponent("Invite-kan lama aqbali karin. Hubi email-ka aad ku soo gashay.")}`);
  redirect("/dashboard");
}

export async function signupInvitedMember(formData: FormData) {
  const token = value(formData, "token");
  const fullName = value(formData, "full_name");
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  if (!fullName || !email || password.length < 8) redirect(`/join/${token}?error=${encodeURIComponent("Magaca, email-ka iyo password 8+ xaraf ah geli.")}`);
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirm`, data: { full_name: fullName, preferred_language: "so", invitation_token: token } } });
  if (error) redirect(`/join/${token}?error=${encodeURIComponent("Account-ka lama samayn. Haddii account jiro, gal kadibna invite-ka aqbal.")}`);
  if (data.session) redirect("/dashboard");
  redirect(`/login?message=${encodeURIComponent("Email-kaaga hubi oo xaqiiji; kadib waxaad geli doontaa agency-ga.")}`);
}

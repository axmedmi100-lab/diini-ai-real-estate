"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { hasAgencyPermission, type AgencyRole } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }

export async function inviteAgencyMember(formData: FormData) {
  const { supabase, membership } = await getAgencyWorkspace();
  if (!hasAgencyPermission(membership.role, "manage_members")) redirect("/agents?error=Kaliya owner-ka ayaa member casuumi kara.");
  const email = value(formData, "email").toLowerCase();
  const role = value(formData, "role") as AgencyRole;
  if (!email || !["admin", "manager", "agent", "receptionist"].includes(role)) redirect("/agents?error=Email ama role sax ah geli.");
  const { data: entitlement } = await supabase.rpc("get_agency_plan_entitlement", { target_agency_id: membership.agency_id, resource_name: "users" });
  if (entitlement?.[0] && !entitlement[0].allowed) redirect("/usage?limit=users");
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.rpc("create_agency_invitation", { target_email: email, target_role: role, raw_token: token });
  if (error) redirect(`/agents?error=${encodeURIComponent(error.message.includes("already") ? "Qofkan horay ayuu member u yahay." : "Martiqaadka lama samayn karin.")}`);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const admin = createAdminClient();
  const { error: emailError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
    data: { invitation_token: token, preferred_language: "so" },
  });
  const message = emailError
    ? "Invite-ka waa la sameeyey, laakiin email-ka lama dirin. Link-ga hoose gacanta kula wadaag qofka."
    : "Martiqaadka email ahaan waa la diray. Link-ga hoose sidoo kale waad copy-gareyn kartaa.";
  redirect(`/agents?message=${encodeURIComponent(message)}&invite=${encodeURIComponent(token)}`);
}

export async function setAvailability(formData: FormData) {
  const { supabase } = await getAgencyWorkspace();
  const availability = value(formData, "availability");
  const { error } = await supabase.rpc("set_my_agency_availability", { new_availability: availability });
  if (error) redirect("/agents?error=Availability-ga lama beddeli karin.");
  revalidatePath("/agents");
}

export async function setMemberAvailability(formData: FormData) {
  const { supabase } = await getAgencyWorkspace();
  const memberId = value(formData, "member_id");
  const availability = value(formData, "availability");
  if (!memberId) redirect("/agents?error=Agent-ka lama aqoonsan.");
  const { error } = await supabase.rpc("set_agency_member_availability", {
    target_member_id: memberId,
    new_availability: availability,
  });
  if (error) redirect("/agents?error=Xaaladda agent-ka lama beddeli karin.");
  revalidatePath("/agents");
  redirect("/agents?message=Xaaladda agent-ka waa la cusboonaysiiyey.");
}


import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAssignableAgents(supabase: SupabaseClient, agencyId: string) {
  const { data: members } = await supabase.from("agency_members").select("id, user_id, role").eq("agency_id", agencyId).eq("is_active", true).in("role", ["owner", "admin", "manager", "agent"]);
  const ids = members?.map((member) => member.user_id) ?? [];
  const { data: profiles } = ids.length ? await supabase.from("user_profiles").select("id, full_name").in("id", ids) : { data: [] };
  const names = new Map(profiles?.map((profile) => [profile.id, profile.full_name]));
  return (members ?? []).map((member) => ({ id: member.id, role: member.role, label: names.get(member.user_id) || `Member ${member.id.slice(0, 6)}` }));
}

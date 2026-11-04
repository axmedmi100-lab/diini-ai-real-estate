import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ACTIVE_AGENCY_COOKIE } from "@/lib/agency-workspace";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("agency_members")
    .select("agency_id, role, agencies(id,name,logo_url,lifecycle_status)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Workspaces lama soo qaadi karin." }, { status: 500 });

  const workspaces = (data ?? []).flatMap((membership) => {
    const relation = membership.agencies as unknown;
    const agency = (Array.isArray(relation) ? relation[0] : relation) as { id: string; name: string; logo_url: string | null; lifecycle_status: string } | null;
    if (!agency || agency.lifecycle_status === "suspended" || agency.lifecycle_status === "archived") return [];
    return [{ id: agency.id, name: agency.name, logoUrl: agency.logo_url, role: membership.role }];
  });

  const selectedAgencyId = (await cookies()).get(ACTIVE_AGENCY_COOKIE)?.value;
  const activeAgencyId = workspaces.some((workspace) => workspace.id === selectedAgencyId)
    ? selectedAgencyId
    : workspaces[0]?.id ?? null;

  return NextResponse.json({ workspaces, activeAgencyId });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { agencyId?: unknown } | null;
  const agencyId = typeof body?.agencyId === "string" ? body.agencyId : "";
  if (!/^[0-9a-f-]{36}$/i.test(agencyId)) return NextResponse.json({ error: "Agency-ga sax ma aha." }, { status: 400 });

  const { data: membership } = await supabase
    .from("agency_members")
    .select("agency_id, agencies(lifecycle_status)")
    .eq("user_id", user.id)
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .maybeSingle();

  const relation = membership?.agencies as unknown;
  const agency = (Array.isArray(relation) ? relation[0] : relation) as { lifecycle_status: string } | null;
  if (!membership || !agency || agency.lifecycle_status === "suspended" || agency.lifecycle_status === "archived") {
    return NextResponse.json({ error: "Agency-kan uma lihid oggolaansho." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_AGENCY_COOKIE, agencyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}


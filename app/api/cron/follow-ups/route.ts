import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { data, error } = await createAdminClient().rpc("process_due_follow_ups", { batch_limit: 100 });
    if (error) throw error;
    return NextResponse.json({ ok: true, result: data?.[0] ?? null });
  } catch (error) {
    console.error("Follow-up processor failed", error);
    return NextResponse.json({ error: "Follow-up processing failed" }, { status: 500 });
  }
}

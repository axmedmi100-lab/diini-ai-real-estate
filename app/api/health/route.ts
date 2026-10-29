import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("platform_plans").select("code", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ status: "ok", app: "healthy", database: "healthy", latency_ms: Date.now()-started, timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", app: "healthy", database: "unavailable", latency_ms: Date.now()-started, timestamp: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}


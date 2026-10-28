import { NextResponse } from "next/server";
import { logServerEvent, requestId } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function run(request: Request) {
  const id = requestId(request);
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized", requestId: id }, { status: 401 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("process_subscription_expiries");
  if (error) {
    logServerEvent("error", "subscription_worker.failed", { requestId: id, code: error.code });
    return NextResponse.json({ error: "Subscription worker failed", requestId: id }, { status: 500 });
  }
  logServerEvent("info", "subscription_worker.completed", { requestId: id, result: data });
  return NextResponse.json({ ok: true, result: data, requestId: id });
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }


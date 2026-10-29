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
  const [{ data: subscriptions, error }, { data: recurringExpenses, error: recurringError }] = await Promise.all([
    supabase.rpc("process_subscription_expiries"),
    supabase.rpc("process_recurring_expenses"),
  ]);
  if (error || recurringError) {
    logServerEvent("error", "finance_worker.failed", { requestId: id, subscriptionCode: error?.code, recurringExpenseCode: recurringError?.code });
    return NextResponse.json({ error: "Subscription worker failed", requestId: id }, { status: 500 });
  }
  const result = { subscriptions, recurring_expenses: recurringExpenses };
  logServerEvent("info", "finance_worker.completed", { requestId: id, result });
  return NextResponse.json({ ok: true, result, requestId: id });
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }


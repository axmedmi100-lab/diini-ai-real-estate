import { NextResponse } from "next/server";

import { logServerEvent, requestId } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/meta";

type ClaimedFollowUp = {
  id: string; agency_id: string; conversation_id: string | null;
  channel: "website" | "whatsapp" | "phone" | "facebook" | "instagram" | "manual";
  message_template: string; attempt_count: number; max_attempts: number;
  external_thread_id: string | null;
  conversation_status: "open" | "ai_active" | "human_active" | "closed" | null;
  customer_opted_out: boolean;
};

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function retryDelay(attempt: number) { return [5, 15, 60, 240][Math.min(Math.max(attempt - 1, 0), 3)]; }

async function runWorker(request: Request) {
  const id = requestId(request);
  if (!authorized(request)) {
    logServerEvent("warn", "follow_up_worker.unauthorized", { requestId: id });
    return NextResponse.json({ error: "Unauthorized", requestId: id }, { status: 401, headers: { "X-Request-Id": id } });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_due_follow_ups", { batch_limit: 100 });
  if (error) {
    logServerEvent("error", "follow_up_worker.claim_failed", { requestId: id, code: error.code });
    return NextResponse.json({ error: "Follow-up claim failed", requestId: id }, { status: 500, headers: { "X-Request-Id": id } });
  }

  const summary = { claimed: data?.length ?? 0, sent: 0, retried: 0, failed: 0, opted_out: 0 };
  for (const item of (data ?? []) as ClaimedFollowUp[]) {
    try {
      if (item.customer_opted_out) {
        await supabase.rpc("opt_out_claimed_follow_up", { target_follow_up_id: item.id });
        summary.opted_out += 1;
        continue;
      }

      let providerMessageId: string | null = null;
      if (item.channel === "whatsapp") {
        if (!item.external_thread_id) throw new Error("WhatsApp conversation ama recipient lama helin.");
        if (item.conversation_status === "human_active") throw new Error("Human agent ayaa conversation-ka gacanta ku haya.");
        providerMessageId = await sendWhatsAppText(item.agency_id, item.external_thread_id, item.message_template);
        await supabase.rpc("record_whatsapp_usage", { target_agency_id: item.agency_id, message_count: 1 });
      } else if (item.channel === "website") {
        if (!item.conversation_id) throw new Error("Website conversation lama helin.");
        if (item.conversation_status === "human_active") throw new Error("Human agent ayaa conversation-ka gacanta ku haya.");
        if (item.conversation_status === "closed") throw new Error("Conversation-ku waa xiran yahay.");
        const { error: messageError } = await supabase.from("messages").insert({ agency_id: item.agency_id, conversation_id: item.conversation_id, sender_type: "ai", message: item.message_template, metadata: { follow_up_id: item.id } });
        if (messageError) throw messageError;
      } else {
        const { error: notificationError } = await supabase.from("notifications").insert({ agency_id: item.agency_id, type: "follow_up_due", title: "Follow-up waqtigiisii gaaray", body: item.message_template, entity_type: "follow_up", entity_id: item.id });
        if (notificationError) throw notificationError;
      }

      const { error: completeError } = await supabase.rpc("complete_follow_up_delivery", { target_follow_up_id: item.id, target_provider_message_id: providerMessageId });
      if (completeError) throw completeError;
      summary.sent += 1;
    } catch (deliveryError) {
      const message = deliveryError instanceof Error ? deliveryError.message : "Delivery failed";
      const { data: nextStatus, error: failureError } = await supabase.rpc("fail_follow_up_delivery", { target_follow_up_id: item.id, failure_message: message, retry_delay_minutes: retryDelay(item.attempt_count) });
      if (failureError) logServerEvent("error", "follow_up_worker.failure_state_failed", { requestId: id, followUpId: item.id, code: failureError.code });
      if (nextStatus === "failed") summary.failed += 1; else summary.retried += 1;
    }
  }
  logServerEvent("info", "follow_up_worker.completed", { requestId: id, ...summary });
  return NextResponse.json({ ok: true, result: summary, requestId: id }, { headers: { "X-Request-Id": id } });
}

export async function GET(request: Request) { return runWorker(request); }
export async function POST(request: Request) { return runWorker(request); }

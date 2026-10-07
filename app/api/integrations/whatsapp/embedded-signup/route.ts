import { NextResponse } from "next/server";

import { encryptIntegrationSecret } from "@/lib/security/integration-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const idPattern = /^\d{5,30}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Fadlan marka hore gal account-kaaga." }, { status: 401 });
  const { data: membership } = await supabase.from("agency_members").select("agency_id,role").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!membership || !new Set(["owner", "admin", "manager"]).has(membership.role)) return NextResponse.json({ error: "Ma lihid oggolaanshaha connection-kan." }, { status: 403 });

  let body: { code?: string; wabaId?: string; phoneNumberId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request-ku sax ma aha." }, { status: 400 }); }
  if (!body.code || !body.wabaId || !body.phoneNumberId || !idPattern.test(body.wabaId) || !idPattern.test(body.phoneNumberId)) return NextResponse.json({ error: "Meta signup data ma dhammaystirna." }, { status: 400 });
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const version = process.env.META_GRAPH_VERSION;
  if (!appId || !appSecret || !version) return NextResponse.json({ error: "DIINI Meta server configuration ma dhammaystirna." }, { status: 503 });

  const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("code", body.code);
  const tokenResponse = await fetch(tokenUrl, { method: "GET", cache: "no-store" });
  const tokenPayload = await tokenResponse.json() as { access_token?: string; error?: { message?: string } };
  if (!tokenResponse.ok || !tokenPayload.access_token) return NextResponse.json({ error: tokenPayload.error?.message || "Meta authorization code lama beddeli karin." }, { status: 400 });
  const token = tokenPayload.access_token;

  const subscribe = await fetch(`https://graph.facebook.com/${version}/${body.wabaId}/subscribed_apps`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!subscribe.ok) return NextResponse.json({ error: "DIINI app-ka WABA webhook looma subscribe-gareyn." }, { status: 400 });
  const profileResponse = await fetch(`https://graph.facebook.com/${version}/${body.phoneNumberId}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${token}` } });
  const profile = await profileResponse.json() as { display_phone_number?: string; verified_name?: string };
  if (!profileResponse.ok) return NextResponse.json({ error: "WhatsApp phone profile lama xaqiijin karin." }, { status: 400 });

  const admin = createAdminClient();
  const { data: secret, error: secretError } = await admin.from("integration_secrets").upsert({ agency_id: membership.agency_id, provider: "whatsapp", encrypted_value: encryptIntegrationSecret(token) }, { onConflict: "agency_id,provider" }).select("id").single();
  if (secretError || !secret) return NextResponse.json({ error: "Token-ka si ammaan ah looma kaydin karin." }, { status: 500 });
  const { error: integrationError } = await admin.from("integrations").update({ status: "connected", external_account_id: body.wabaId, public_config: { phone_number_id: body.phoneNumberId, business_account_id: body.wabaId, display_phone_number: profile.display_phone_number, verified_name: profile.verified_name, onboarding: "embedded_signup" }, secret_reference: secret.id, connected_at: new Date().toISOString() }).eq("agency_id", membership.agency_id).eq("provider", "whatsapp");
  if (integrationError) return NextResponse.json({ error: "WhatsApp integration-ka lama kaydin karin." }, { status: 500 });
  await admin.from("audit_logs").insert({ agency_id: membership.agency_id, user_id: user.id, action: "integration.whatsapp_embedded_signup", entity_type: "integration", metadata: { waba_id: body.wabaId, phone_number_id: body.phoneNumberId } });
  return NextResponse.json({ connected: true });
}

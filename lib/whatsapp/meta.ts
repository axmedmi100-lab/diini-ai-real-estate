import { createHmac, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptIntegrationSecret } from "@/lib/security/integration-secret";
import { getEvolutionInstanceForAgency, sendEvolutionImage, sendEvolutionText } from "@/lib/whatsapp/evolution";

type WhatsAppConfig = { phone_number_id?: string; display_phone_number?: string; verified_name?: string };

export function verifyMetaSignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signature.slice(7);
  if (!/^[0-9a-f]{64}$/i.test(received) || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export async function getWhatsAppIntegration(agencyId: string) {
  const { data, error } = await createAdminClient().from("integrations").select("status,public_config,secret_reference").eq("agency_id", agencyId).eq("provider", "whatsapp").maybeSingle();
  if (error || !data || data.status !== "connected") throw new Error("WhatsApp integration is not connected.");
  const config = data.public_config as WhatsAppConfig;
  let token = data.secret_reference ? process.env[data.secret_reference] : undefined;
  if (!token && data.secret_reference) {
    const { data: stored } = await createAdminClient().from("integration_secrets").select("encrypted_value").eq("id", data.secret_reference).eq("agency_id", agencyId).eq("provider", "whatsapp").maybeSingle();
    if (stored) token = decryptIntegrationSecret(stored.encrypted_value);
  }
  if (!config.phone_number_id || !token) throw new Error("WhatsApp server credentials are incomplete.");
  return { config, token };
}

export async function sendWhatsAppText(agencyId: string, to: string, body: string) {
  const evolution = process.env.EVOLUTION_ENABLED === "true" ? await getEvolutionInstanceForAgency(agencyId) : null;
  if (evolution) return sendEvolutionText(evolution.instanceName, to, body);
  const { config, token } = await getWhatsAppIntegration(agencyId);
  const version = process.env.META_GRAPH_VERSION;
  if (!version || !/^v\d+\.\d+$/.test(version)) throw new Error("META_GRAPH_VERSION is missing or invalid.");
  const response = await fetch(`https://graph.facebook.com/${version}/${config.phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json() as { messages?: Array<{ id: string }>; error?: { message?: string } };
  if (!response.ok || !payload.messages?.[0]?.id) throw new Error(payload.error?.message || "Meta message send failed.");
  return payload.messages[0].id;
}

export async function sendWhatsAppImage(agencyId: string, to: string, imageUrl: string, caption = "") {
  const mediaUrl = new URL(imageUrl);
  if (mediaUrl.protocol !== "https:") throw new Error("WhatsApp image URL must use HTTPS.");
  const evolution = process.env.EVOLUTION_ENABLED === "true" ? await getEvolutionInstanceForAgency(agencyId) : null;
  if (evolution) return sendEvolutionImage(evolution.instanceName, to, mediaUrl.toString(), caption);
  const { config, token } = await getWhatsAppIntegration(agencyId);
  const version = process.env.META_GRAPH_VERSION;
  if (!version || !/^v\d+\.\d+$/.test(version)) throw new Error("META_GRAPH_VERSION is missing or invalid.");
  const response = await fetch(`https://graph.facebook.com/${version}/${config.phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "image", image: { link: mediaUrl.toString(), caption: caption.slice(0, 1024) } }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json() as { messages?: Array<{ id: string }>; error?: { message?: string } };
  if (!response.ok || !payload.messages?.[0]?.id) throw new Error(payload.error?.message || "Meta image send failed.");
  return payload.messages[0].id;
}

export async function validateWhatsAppPhone(phoneNumberId: string, token: string) {
  const version = process.env.META_GRAPH_VERSION;
  if (!version || !/^v\d+\.\d+$/.test(version)) throw new Error("META_GRAPH_VERSION is missing or invalid.");
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json() as WhatsAppConfig & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Meta phone validation failed.");
  return payload;
}


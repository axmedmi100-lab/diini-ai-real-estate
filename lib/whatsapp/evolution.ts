import { createAdminClient } from "@/lib/supabase/admin";

type EvolutionInstance = {
  agencyId: string;
  instanceName: string;
  connectionStatus: string;
  ownerJid: string | null;
  legacy?: boolean;
};

function evolutionConfig() {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (process.env.EVOLUTION_ENABLED !== "true" || !baseUrl || !apiKey) throw new Error("Evolution API is not configured.");
  return { baseUrl, apiKey };
}

async function evolutionRequest(path: string, init?: RequestInit) {
  const { baseUrl, apiKey } = evolutionConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { apikey: apiKey, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : `HTTP ${response.status}`;
    throw new Error(`Evolution API request failed: ${detail}`);
  }
  return payload;
}

function legacyInstanceForAgency(agencyId: string): EvolutionInstance | null {
  const instanceName = process.env.EVOLUTION_INSTANCE;
  const legacyAgencyId = process.env.EVOLUTION_AGENCY_ID;
  if (legacyAgencyId !== agencyId || !instanceName) return null;
  return { agencyId, instanceName, connectionStatus: "open", ownerJid: null, legacy: true };
}

export async function getEvolutionInstanceForAgency(agencyId: string): Promise<EvolutionInstance | null> {
  const { data, error } = await createAdminClient().from("evolution_instances").select("agency_id,instance_name,connection_status,owner_jid").eq("agency_id", agencyId).maybeSingle();
  if (!error && data) return { agencyId: data.agency_id, instanceName: data.instance_name, connectionStatus: data.connection_status, ownerJid: data.owner_jid };
  return legacyInstanceForAgency(agencyId);
}

export async function getEvolutionInstanceByName(instanceName: string): Promise<EvolutionInstance | null> {
  const { data, error } = await createAdminClient().from("evolution_instances").select("agency_id,instance_name,connection_status,owner_jid").eq("instance_name", instanceName).maybeSingle();
  if (!error && data) return { agencyId: data.agency_id, instanceName: data.instance_name, connectionStatus: data.connection_status, ownerJid: data.owner_jid };
  const agencyId = process.env.EVOLUTION_AGENCY_ID;
  if (instanceName === process.env.EVOLUTION_INSTANCE && agencyId && /^[0-9a-f-]{36}$/i.test(agencyId)) return legacyInstanceForAgency(agencyId);
  return null;
}

export async function createEvolutionInstance(agencyId: string) {
  const existing = await getEvolutionInstanceForAgency(agencyId);
  if (existing) return existing;
  const instanceName = `agency-${agencyId.replaceAll("-", "").slice(0, 20)}`;
  await evolutionRequest("/instance/create", { method: "POST", body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true }) });
  const { error } = await createAdminClient().from("evolution_instances").insert({ agency_id: agencyId, instance_name: instanceName, connection_status: "connecting" });
  if (error) throw new Error(`Evolution instance mapping failed: ${error.message}`);
  await configureEvolutionWebhook(instanceName);
  return { agencyId, instanceName, connectionStatus: "connecting", ownerJid: null } satisfies EvolutionInstance;
}

export async function configureEvolutionWebhook(instanceName: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const webhookToken = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (!siteUrl?.startsWith("https://") || !webhookToken) throw new Error("Evolution webhook configuration is incomplete.");
  await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ webhook: { enabled: true, url: `${siteUrl}/api/webhooks/evolution?token=${encodeURIComponent(webhookToken)}`, webhookByEvents: false, webhookBase64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } }),
  });
}

export async function refreshEvolutionInstance(agencyId: string) {
  const mapped = await getEvolutionInstanceForAgency(agencyId);
  if (!mapped) return null;
  const payload = await evolutionRequest("/instance/fetchInstances") as Array<Record<string, unknown>>;
  const current = Array.isArray(payload) ? payload.find((item) => item.name === mapped.instanceName || item.instanceName === mapped.instanceName) : null;
  const connectionStatus = String(current?.connectionStatus ?? current?.status ?? mapped.connectionStatus).toLowerCase();
  const ownerJid = typeof current?.ownerJid === "string" ? current.ownerJid : mapped.ownerJid;
  if (!mapped.legacy) await createAdminClient().from("evolution_instances").update({ connection_status: connectionStatus === "open" ? "open" : "connecting", owner_jid: ownerJid, connected_at: connectionStatus === "open" ? new Date().toISOString() : null, last_error: null }).eq("agency_id", agencyId);
  return { ...mapped, connectionStatus, ownerJid };
}

export async function getEvolutionQr(instanceName: string) {
  const payload = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`) as Record<string, unknown>;
  const nested = payload.qrcode && typeof payload.qrcode === "object" ? payload.qrcode as Record<string, unknown> : {};
  const raw = payload.base64 ?? nested.base64;
  if (typeof raw !== "string" || !raw) return null;
  return raw.startsWith("data:image/") ? raw : `data:image/png;base64,${raw}`;
}

export async function logoutEvolutionInstance(instanceName: string) {
  await evolutionRequest(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
}

export async function sendEvolutionText(instanceName: string, to: string, body: string) {
  const payload = await evolutionRequest(`/message/sendText/${encodeURIComponent(instanceName)}`, { method: "POST", body: JSON.stringify({ number: to.replace(/\D/g, ""), text: body }) }) as { key?: { id?: string }; messageId?: string };
  const messageId = payload.key?.id || payload.messageId;
  if (!messageId) throw new Error("Evolution message ID was not returned.");
  return messageId;
}

export async function sendEvolutionImage(instanceName: string, to: string, media: string, caption: string) {
  const payload = await evolutionRequest(`/message/sendMedia/${encodeURIComponent(instanceName)}`, { method: "POST", body: JSON.stringify({ number: to.replace(/\D/g, ""), mediatype: "image", mimetype: "image/jpeg", media, caption: caption.slice(0, 1024) }) }) as { key?: { id?: string }; messageId?: string };
  const messageId = payload.key?.id || payload.messageId;
  if (!messageId) throw new Error("Evolution media message ID was not returned.");
  return messageId;
}


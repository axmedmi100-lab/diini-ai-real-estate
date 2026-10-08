import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

export const MAX_JSON_BYTES = 32_768;
export const MAX_WEBHOOK_BYTES = 262_144;

export function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[a-zA-Z0-9._-]{8,100}$/.test(supplied) ? supplied : randomUUID();
}

export function contentLengthExceeds(request: Request, maximum: number) {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > maximum;
}

export function apiError(message: string, status: number, id: string) {
  return NextResponse.json({ error: message, requestId: id }, { status, headers: { "X-Request-Id": id, "Cache-Control": "no-store" } });
}

export function logServerEvent(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

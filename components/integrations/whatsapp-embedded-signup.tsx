"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    FB?: { init(options: Record<string, unknown>): void; login(callback: (response: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>): void };
    fbAsyncInit?: () => void;
  }
}

type SessionInfo = { wabaId?: string; phoneNumberId?: string };

export function WhatsAppEmbeddedSignup({ appId, configId, enabled }: { appId?: string; configId?: string; enabled: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const session = useRef<SessionInfo>({});

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (!new Set(["https://www.facebook.com", "https://web.facebook.com"]).has(event.origin)) return;
      let data: unknown = event.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
      if (!data || typeof data !== "object") return;
      const message = data as { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string } };
      if (message.type === "WA_EMBEDDED_SIGNUP" && message.event === "FINISH") session.current = { wabaId: message.data?.waba_id, phoneNumberId: message.data?.phone_number_id };
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  function initialize() {
    if (!appId) return;
    window.fbAsyncInit = () => { window.FB?.init({ appId, autoLogAppEvents: true, xfbml: true, version: process.env.NEXT_PUBLIC_META_GRAPH_VERSION || "v23.0" }); setReady(true); };
    window.fbAsyncInit();
  }

  function connect() {
    if (!window.FB || !configId) return;
    setStatus("Meta signup ayaa furmaya...");
    window.FB.login(async (response) => {
      const code = response.authResponse?.code;
      const { wabaId, phoneNumberId } = session.current;
      if (!code || !wabaId || !phoneNumberId) { setStatus("Signup-ka lama dhammaystirin. Mar kale isku day."); return; }
      setStatus("Connection-ka ayaa la xaqiijinayaa...");
      const result = await fetch("/api/integrations/whatsapp/embedded-signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, wabaId, phoneNumberId }) });
      const payload = await result.json();
      if (!result.ok) { setStatus(payload.error || "Connection-ku wuu fashilmay."); return; }
      router.push("/integrations/whatsapp?message=WhatsApp%20waa%20connected.");
      router.refresh();
    }, { config_id: configId, response_type: "code", override_default_response_type: true, extras: { sessionInfoVersion: "3" } });
  }

  return <><Script onLoad={initialize} src="https://connect.facebook.net/en_US/sdk.js" strategy="afterInteractive"/><button className="rounded-xl bg-[#1877F2] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!enabled || !ready || !appId || !configId} onClick={connect} type="button">Connect with Meta</button>{!appId || !configId ? <p className="mt-3 text-xs text-amber-700">DIINI Meta App ID iyo Embedded Signup Configuration ID wali lama dejin.</p> : null}{status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}</>;
}

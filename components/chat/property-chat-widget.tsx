"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = { sender_type: "customer" | "ai" | "agent" | "system"; message: string; properties?: Property[] };
type Property = { id: string; title: string; district: string; price: number; currency: string; bedrooms: number | null; bathrooms: number | null; image_urls: string[] };
type Config = { agency_name: string; assistant_name: string; is_enabled: boolean };

export function PropertyChatWidget({ agencyId }: { agencyId: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [bookingProperty, setBookingProperty] = useState<Property | null>(null);
  const [bookingTime, setBookingTime] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = `diini-session-${agencyId}`;
    let token = localStorage.getItem(key);
    if (!token) { token = crypto.randomUUID(); localStorage.setItem(key, token); }
    sessionStorage.setItem("diini-current-token", token);
    fetch("/api/widget/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", agencyId, sessionToken: token }) })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then((data) => { setConfig(data.config); setConversationId(data.conversationId); setMessages(data.messages); })
      .catch((reason) => setError(reason.message || "Chat-ka lama bilaabi karin."))
      .finally(() => setLoading(false));
  }, [agencyId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    const token = sessionStorage.getItem("diini-current-token");
    if (!message || !token || !conversationId || sending) return;
    setInput(""); setError(""); setSending(true); setMessages((current) => [...current, { sender_type: "customer", message }]);
    try {
      const response = await fetch("/api/widget/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "message", agencyId, conversationId, sessionToken: token, message }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessages((current) => [...current, { sender_type: "ai", message: data.message, properties: data.properties }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Fariinta lama diri karin."); }
    finally { setSending(false); }
  }

  async function bookViewing(event: FormEvent) {
    event.preventDefault();
    const token = sessionStorage.getItem("diini-current-token");
    if (!token || !bookingProperty || !bookingTime || sending) return;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/widget/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "book_viewing", agencyId, conversationId, sessionToken: token, propertyId: bookingProperty.id, startsAt: new Date(bookingTime).toISOString() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessages((current) => [...current, { sender_type: "ai", message: data.message }]);
      setBookingProperty(null); setBookingTime("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Viewing-ga lama codsan karin."); }
    finally { setSending(false); }
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl">
      <header className="bg-slate-950 px-5 py-4 text-white"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950">AI</div><div><h1 className="font-bold">{config?.assistant_name || "AI Property Assistant"}</h1><p className="text-xs text-slate-400">{config?.agency_name || "DIINI AI"} · Online</p></div></div></header>
      <section className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Chat-ka ayaa furmaya...</p> : null}
        {messages.map((item, index) => <div className={item.sender_type === "customer" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[92%]"} key={`${index}-${item.message.slice(0, 10)}`}><div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${item.sender_type === "customer" ? "rounded-br-md bg-slate-950 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}>{item.message}</div>{item.properties?.map((property) => { const image = Array.isArray(property.image_urls) ? property.image_urls[0] : null; return <article className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white" key={property.id}>{image ? <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} /> : null}<div className="p-3"><h2 className="text-sm font-bold text-slate-950">{property.title}</h2><p className="mt-1 text-xs text-slate-500">{property.district} · {property.bedrooms ?? 0} qol</p><p className="mt-2 font-bold text-emerald-700">{new Intl.NumberFormat("en", { style: "currency", currency: property.currency, maximumFractionDigits: 0 }).format(Number(property.price))}</p><button className="mt-3 w-full rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950" onClick={() => setBookingProperty(property)} type="button">Codso viewing</button></div></article>; })}</div>)}
        {bookingProperty ? <form className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" onSubmit={bookViewing}><p className="text-sm font-bold text-slate-950">Viewing: {bookingProperty.title}</p><label className="mt-3 block text-xs font-semibold text-slate-600">Dooro taariikh iyo waqti<input className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" min={new Date().toISOString().slice(0, 16)} onChange={(event) => setBookingTime(event.target.value)} required type="datetime-local" value={bookingTime} /></label><div className="mt-3 flex gap-2"><button className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white" disabled={!bookingTime || sending}>Dir codsiga</button><button className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold" onClick={() => setBookingProperty(null)} type="button">Ka noqo</button></div></form> : null}
        {sending ? <div className="w-fit rounded-2xl border bg-white px-4 py-3 text-sm text-slate-500">AI-gu wuu qorayaa…</div> : null}
        {error ? <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p> : null}<div ref={bottom} />
      </section>
      <form className="flex gap-2 border-t border-slate-200 bg-white p-3" onSubmit={send}><input aria-label="Fariinta" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500" disabled={loading || !!error && !conversationId} onChange={(event) => setInput(event.target.value)} placeholder="Qor waxa aad raadinayso..." value={input} /><button className="rounded-xl bg-emerald-500 px-4 text-sm font-black text-slate-950 disabled:opacity-50" disabled={sending || !input.trim()}>Dir</button></form>
    </main>
  );
}

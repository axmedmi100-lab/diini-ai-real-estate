import { notFound } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { sendAgentMessage, setConversationMode } from "@/app/conversations/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function ConversationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { supabase, user, agency } = await getAgencyWorkspace();
  const { id } = await params;
  const query = await searchParams;
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase.from("conversations").select("id, channel, status, created_at, leads(id, name, phone, email)").eq("agency_id", agency.id).eq("id", id).maybeSingle(),
    supabase.from("messages").select("id, sender_type, message, created_at").eq("agency_id", agency.id).eq("conversation_id", id).order("created_at"),
  ]);
  if (!conversation) notFound();
  const lead = Array.isArray(conversation.leads) ? conversation.leads[0] : conversation.leads;

  return (
    <AppShell agencyName={agency.name} currentPath="/conversations" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-4xl space-y-7">
        <PageHeading eyebrow={`${conversation.channel} · ${conversation.status}`} title={lead?.name || "Website visitor"} description={lead?.phone || lead?.email || "Xog xiriir weli lama helin."} />
        <AuthMessage error={query.error} message={query.message} />
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><p className="text-sm font-bold text-slate-950">{conversation.status === "human_active" ? "Human active — AI waa hakad" : "AI active"}</p><p className="mt-1 text-xs text-slate-500">AI iyo agent isku mar kama jawaabi karaan conversation-kan.</p></div><form action={setConversationMode}><input name="conversation_id" type="hidden" value={conversation.id} /><input name="mode" type="hidden" value={conversation.status === "human_active" ? "ai_active" : "human_active"} /><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">{conversation.status === "human_active" ? "Return to AI" : "Take over"}</button></form></section>
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {messages?.map((message) => <article className={`flex ${message.sender_type === "customer" ? "justify-start" : "justify-end"}`} key={message.id}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${message.sender_type === "customer" ? "bg-slate-100 text-slate-800" : "bg-emerald-500 text-slate-950"}`}><p className="whitespace-pre-wrap text-sm leading-6">{message.message}</p><p className="mt-1 text-[10px] opacity-60">{message.sender_type} · {new Date(message.created_at).toLocaleString()}</p></div></article>)}
        </section>
        {conversation.status === "human_active" ? <form action={sendAgentMessage} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><input name="conversation_id" type="hidden" value={conversation.id} /><label className="text-sm font-bold text-slate-700">Agent reply<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm" maxLength={4000} name="message" required /></label><button className="mt-3 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950">Kaydi reply-ga</button><p className="mt-2 text-xs text-slate-500">Website delivery transport-ka real-time ah wali ma jiro; fariintu conversation history-ga ayay galaysaa.</p></form> : null}
      </div>
    </AppShell>
  );
}

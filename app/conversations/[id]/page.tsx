import { notFound } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, agency } = await getAgencyWorkspace();
  const { id } = await params;
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
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {messages?.map((message) => <article className={`flex ${message.sender_type === "customer" ? "justify-start" : "justify-end"}`} key={message.id}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${message.sender_type === "customer" ? "bg-slate-100 text-slate-800" : "bg-emerald-500 text-slate-950"}`}><p className="whitespace-pre-wrap text-sm leading-6">{message.message}</p><p className="mt-1 text-[10px] opacity-60">{message.sender_type} · {new Date(message.created_at).toLocaleString()}</p></div></article>)}
        </section>
      </div>
    </AppShell>
  );
}

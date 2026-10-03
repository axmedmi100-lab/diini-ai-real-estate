import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";

const statusStyles: Record<string, string> = {
  ai_active: "bg-sky-100 text-sky-800",
  human_active: "bg-amber-100 text-amber-800",
  closed: "bg-slate-100 text-slate-600",
};

export default async function ConversationsPage() {
  const { supabase, user, agency } = await getAgencyWorkspace();
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, channel, status, created_at, updated_at, leads(name, phone, email)")
    .eq("agency_id", agency.id)
    .order("updated_at", { ascending: false });

  return (
    <AppShell agencyName={agency.name} currentPath="/conversations" logoutAction={logout} userEmail={user.email}>
      <div className="mx-auto w-full max-w-6xl space-y-7">
        <PageHeading eyebrow="Inbox" title="Conversations" description="Ka eeg wada-hadallada website-ka iyo kuwa u baahan agent bani-aadam ah." />
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {conversations?.length ? <div className="divide-y divide-slate-100">{conversations.map((conversation) => {
            const lead = Array.isArray(conversation.leads) ? conversation.leads[0] : conversation.leads;
            return <Link className="flex items-center justify-between gap-5 p-5 transition hover:bg-slate-50" href={`/conversations/${conversation.id}`} key={conversation.id}>
              <div className="min-w-0"><p className="truncate font-bold text-slate-950">{lead?.name || lead?.phone || lead?.email || "Website visitor"}</p><p className="mt-1 text-xs capitalize text-slate-500">{conversation.channel} · {new Date(conversation.updated_at).toLocaleString()}</p></div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusStyles[conversation.status] ?? "bg-slate-100 text-slate-700"}`}>{conversation.status === "human_active" ? "Agent loo baahan yahay" : conversation.status === "ai_active" ? "AI active" : "Closed"}</span>
            </Link>;
          })}</div> : <div className="p-6"><EmptyState title="Conversation ma jiro" description="Marka qof widget-ka website-ka isticmaalo, wada-hadalku halkan ayuu ka muuqanayaa." /></div>}
        </section>
      </div>
    </AppShell>
  );
}

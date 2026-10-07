import Link from "next/link";

import { logout } from "@/app/(auth)/actions";
import { PageHeading } from "@/components/dashboard/page-heading";
import { AppShell } from "@/components/layout/app-shell";
import { getAgencyWorkspace } from "@/lib/agency-workspace";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

const entityLinks: Record<string, string> = { lead: "/leads", viewing: "/viewings", conversation: "/conversations" };

export default async function NotificationsPage() {
  const { supabase, user, agency } = await getAgencyWorkspace();
  const { data: notifications } = await supabase.from("notifications").select("id,type,title,body,entity_type,entity_id,read_at,created_at").eq("agency_id", agency.id).or(`user_id.is.null,user_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(100);
  const unread = notifications?.filter((item) => !item.read_at).length ?? 0;
  return <AppShell agencyName={agency.name} currentPath="/notifications" logoutAction={logout} userEmail={user.email}><div className="mx-auto w-full max-w-5xl space-y-7"><PageHeading eyebrow="Activity center" title="Notifications" description={`${unread} notification oo aan la akhrin.`} action={unread ? <form action={markAllNotificationsRead}><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Dhammaan akhri</button></form> : undefined}/><section className="divide-y overflow-hidden rounded-2xl border border-slate-200 bg-white">{notifications?.map((item) => { const href = item.entity_type && entityLinks[item.entity_type] ? `${entityLinks[item.entity_type]}/${item.entity_id}` : null; return <article className={`p-5 ${item.read_at ? "opacity-65" : "bg-emerald-50/40"}`} key={item.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="font-bold text-slate-950">{item.title}</h2>{!item.read_at ? <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Unread"/> : null}</div>{item.body ? <p className="mt-1 text-sm text-slate-600">{item.body}</p> : null}<time className="mt-2 block text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</time></div><div className="flex gap-2">{href ? <Link className="rounded-lg border px-3 py-2 text-xs font-bold" href={href}>Fur</Link> : null}{!item.read_at ? <form action={markNotificationRead}><input name="notification_id" type="hidden" value={item.id}/><button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Akhriyey</button></form> : null}</div></div></article>})}{!notifications?.length ? <p className="p-10 text-center text-sm text-slate-500">Notification wali ma jiro.</p> : null}</section></div></AppShell>;
}

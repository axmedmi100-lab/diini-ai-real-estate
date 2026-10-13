import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "./brand";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Properties", href: "/properties", icon: "home" },
  { label: "Leads", href: "/leads", icon: "target" },
  { label: "Customers", href: "/customers", icon: "users" },
  { label: "AI Chat", href: "/ai-chat", icon: "spark" },
  { label: "Conversations", href: "/conversations", icon: "chat" },
  { label: "Viewings", href: "/viewings", icon: "calendar" },
  { label: "Follow-ups", href: "/follow-ups", icon: "repeat" },
  { label: "Agents", href: "/agents", icon: "agent" },
  { label: "Integrations", href: "/integrations", icon: "plug" },
  { label: "Plan & Usage", href: "/usage", icon: "chart" },
  { label: "Notifications", href: "/notifications", icon: "bell" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

function NavIcon({ name }: Readonly<{ name: string }>) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M22 12h-3"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    spark: <path d="m12 3-1.4 4.2a5 5 0 0 1-3.2 3.2L3 12l4.4 1.6a5 5 0 0 1 3.2 3.2L12 21l1.4-4.2a5 5 0 0 1 3.2-3.2L21 12l-4.4-1.6a5 5 0 0 1-3.2-3.2L12 3Z"/>,
    chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    repeat: <><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></>,
    agent: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    plug: <><path d="m12 22 1-5-4-2 6-6 2 4 5-1"/><path d="M2 12h5M5 9v6"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.4v-4h.1A1.7 1.7 0 0 0 4.2 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.6 4.2a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2.4h4v.1A1.7 1.7 0 0 0 15 4.2a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8.6a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7 1Z"/></>,
  };
  return <svg aria-hidden className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>;
}

type AppShellProps = Readonly<{ children: ReactNode; currentPath: string; agencyName?: string; userEmail?: string; logoutAction?: () => Promise<void> }>;

export function AppShell({ children, currentPath, agencyName = "DIINI Real Estate", userEmail, logoutAction }: AppShellProps) {
  const initials = agencyName.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return (
    <div className="min-h-screen bg-[#f5f7f9] lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden min-h-screen border-r border-white/5 bg-[#08111f] px-3 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="px-2"><Brand inverted /></div>
        <div className="mx-1 mt-7 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.045] p-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-xs font-black text-emerald-300">{initials}</span>
          <div className="min-w-0"><p className="text-[9px] font-bold tracking-[.18em] text-slate-500 uppercase">Agency workspace</p><p className="mt-1 truncate text-[13px] font-semibold text-slate-100">{agencyName}</p></div>
        </div>
        <nav aria-label="Main navigation" className="mt-5 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:none]">
          <ul className="space-y-0.5">{navigation.map((item) => { const active = currentPath === item.href || (item.href !== "/dashboard" && currentPath.startsWith(`${item.href}/`)); return <li key={item.href}><Link aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${active ? "bg-emerald-400 text-slate-950 shadow-[0_8px_24px_rgba(16,185,129,.16)]" : "text-slate-400 hover:bg-white/[.06] hover:text-slate-100"}`} href={item.href}><span className={active ? "text-slate-950" : "text-slate-500 group-hover:text-emerald-400"}><NavIcon name={item.icon} /></span>{item.label}{active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-slate-950/60" /> : null}</Link></li>; })}</ul>
        </nav>
        <div className="mx-1 mt-4 rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/10 to-cyan-400/5 p-4"><div className="flex items-center gap-2"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"/><span className="relative h-2 w-2 rounded-full bg-emerald-400"/></span><p className="text-[10px] font-bold tracking-[.16em] text-emerald-300 uppercase">System online</p></div><p className="mt-2 text-xs leading-5 text-slate-400">AI reception iyo sales workspace-kaagu waa diyaar.</p></div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
          <div className="flex min-h-[4.5rem] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
            <div className="lg:hidden"><Brand /></div><div className="hidden lg:block"><p className="text-[10px] font-bold tracking-[.18em] text-slate-400 uppercase">Workspace</p><p className="mt-0.5 text-sm font-semibold text-slate-800">{agencyName}</p></div>
            <div className="flex items-center gap-3"><Link className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700" href="/notifications"><NavIcon name="bell"/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white"/></Link>{userEmail ? <div className="hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-3 shadow-sm sm:flex"><span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-[10px] font-bold text-white">{userEmail.slice(0, 1).toUpperCase()}</span><span className="max-w-44 truncate text-xs font-medium text-slate-600">{userEmail}</span></div> : null}{logoutAction ? <form action={logoutAction}><button className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" type="submit">Ka bax</button></form> : null}</div>
          </div>
          <nav aria-label="Mobile navigation" className="overflow-x-auto border-t border-slate-100 px-4 lg:hidden [scrollbar-width:none]"><ul className="flex min-w-max gap-1 py-2">{navigation.map((item) => { const active = currentPath === item.href; return <li key={item.href}><Link aria-current={active ? "page" : undefined} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${active ? "bg-slate-950 text-white" : "text-slate-500"}`} href={item.href}><NavIcon name={item.icon}/>{item.label}</Link></li>; })}</ul></nav>
        </header>
        <main className="flex min-w-0 flex-1 p-4 sm:p-7 lg:p-10">{children}</main>
      </div>
    </div>
  );
}


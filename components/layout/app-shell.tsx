import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "./brand";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "Properties", href: "/properties", icon: "⌂" },
  { label: "Leads", href: "/leads", icon: "◎" },
  { label: "AI Chat", href: "/ai-chat", icon: "✦" },
  { label: "Conversations", href: "/conversations", icon: "◌" },
  { label: "Viewings", href: "/viewings", icon: "◷" },
  { label: "Follow-ups", href: "/follow-ups", icon: "↻" },
  { label: "Agents", href: "/agents", icon: "◉" },
  { label: "Settings", href: "/settings", icon: "⚙" },
];

type AppShellProps = Readonly<{
  children: ReactNode;
  currentPath: string;
  agencyName?: string;
  userEmail?: string;
  logoutAction?: () => Promise<void>;
}>;

export function AppShell({ children, currentPath, agencyName = "DIINI Real Estate", userEmail, logoutAction }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f8f7] lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-white/10 bg-slate-950 px-4 py-6 text-white lg:flex lg:flex-col">
        <Brand inverted />
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-bold tracking-[0.16em] text-emerald-400 uppercase">Agency workspace</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{agencyName}</p>
        </div>
        <nav aria-label="Main navigation" className="mt-6">
          <ul className="space-y-1.5">
            {navigation.map((item) => {
              const active = currentPath === item.href;
              return (
                <li key={item.href}>
                  <Link aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${active ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`} href={item.href}>
                    <span aria-hidden className="w-5 text-center text-base">{item.icon}</span>{item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold text-white">DIINI AI</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Sales, reception iyo leads hal meel.</p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="flex min-h-18 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden"><Brand /></div>
            <div className="hidden lg:block"><p className="text-xs font-bold tracking-[0.14em] text-slate-400 uppercase">Workspace</p><p className="text-sm font-semibold text-slate-900">{agencyName}</p></div>
            <div className="flex items-center gap-3">
              {userEmail ? <span className="hidden max-w-52 truncate text-xs text-slate-500 sm:inline">{userEmail}</span> : null}
              {logoutAction ? <form action={logoutAction}><button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" type="submit">Ka bax</button></form> : null}
            </div>
          </div>
          <nav aria-label="Mobile navigation" className="overflow-x-auto border-t border-slate-100 px-4 lg:hidden">
            <ul className="flex min-w-max gap-6">
              {navigation.map((item) => {
                const active = currentPath === item.href;
                return <li key={item.href}><Link aria-current={active ? "page" : undefined} className={`block border-b-2 py-3 text-sm font-semibold ${active ? "border-emerald-500 text-slate-950" : "border-transparent text-slate-500"}`} href={item.href}>{item.label}</Link></li>;
              })}
            </ul>
          </nav>
        </header>
        <main className="flex flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "@/components/layout/brand";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/agencies", label: "Agencies" },
];

export function AdminShell({ children, currentPath, userEmail }: Readonly<{ children: ReactNode; currentPath: string; userEmail?: string }>) {
  return <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[17rem_1fr]">
    <aside className="border-b border-white/10 bg-slate-950 p-5 text-white lg:min-h-screen lg:border-r lg:border-b-0">
      <Brand inverted />
      <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3"><p className="text-[10px] font-black tracking-[.18em] text-emerald-300 uppercase">Platform control</p><p className="mt-1 text-sm font-bold">Super Admin</p></div>
      <nav className="mt-5"><ul className="flex gap-2 lg:block lg:space-y-2">{links.map((item) => <li key={item.href}><Link className={`block rounded-xl px-4 py-3 text-sm font-bold ${currentPath === item.href ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-white/10"}`} href={item.href}>{item.label}</Link></li>)}</ul></nav>
      <Link className="mt-6 block text-xs font-semibold text-slate-400 hover:text-white" href="/dashboard">← Agency workspace</Link>
    </aside>
    <div className="min-w-0"><header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8"><p className="text-xs font-bold tracking-[.14em] text-slate-400 uppercase">DIINI Platform</p><p className="mt-1 text-sm font-semibold text-slate-800">{userEmail}</p></header><main className="p-5 sm:p-8">{children}</main></div>
  </div>;
}

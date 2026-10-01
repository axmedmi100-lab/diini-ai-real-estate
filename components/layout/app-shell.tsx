import type { ReactNode } from "react";

import { Brand } from "./brand";

const navigation = [
  "Dashboard",
  "Properties",
  "Leads",
  "Customers",
  "Conversations",
  "Viewings",
  "Agents",
  "Settings",
];

type AppShellProps = Readonly<{
  children: ReactNode;
  agencyName?: string;
  userEmail?: string;
  logoutAction?: () => Promise<void>;
}>;

export function AppShell({
  children,
  agencyName = "DIINI Real Estate",
  userEmail,
  logoutAction,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-slate-200 bg-slate-950 px-4 py-6 text-white lg:flex lg:flex-col">
        <Brand inverted />

        <nav aria-label="Main navigation" className="mt-10">
          <ul className="space-y-1">
            {navigation.map((item, index) => (
              <li key={item}>
                <a
                  aria-current={index === 0 ? "page" : undefined}
                  className={`block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    index === 0
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                  href="#"
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-slate-400">
          AI Real Estate Sales &amp; Reception System
        </p>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex min-h-18 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden">
              <Brand />
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-slate-900">Workspace</p>
              <p className="text-xs text-slate-500">{agencyName}</p>
            </div>
            <div className="flex items-center gap-3">
              {userEmail ? (
                <span className="hidden text-xs text-slate-500 sm:inline">{userEmail}</span>
              ) : null}
              {logoutAction ? (
                <form action={logoutAction}>
                  <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="submit">
                    Ka bax
                  </button>
                </form>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">DA</div>
              )}
            </div>
          </div>

          <nav
            aria-label="Mobile navigation"
            className="overflow-x-auto border-t border-slate-100 px-4 lg:hidden"
          >
            <ul className="flex min-w-max gap-5">
              {navigation.slice(0, 5).map((item, index) => (
                <li key={item}>
                  <a
                    aria-current={index === 0 ? "page" : undefined}
                    className={`block border-b-2 py-3 text-sm font-medium ${
                      index === 0
                        ? "border-emerald-500 text-slate-950"
                        : "border-transparent text-slate-500"
                    }`}
                    href="#"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main className="flex flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

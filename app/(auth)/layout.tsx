import type { ReactNode } from "react";

import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="grid min-h-screen bg-[#08111f] lg:grid-cols-[minmax(0,1.25fr)_minmax(30rem,.75fr)]">
      <section className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl"/><div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl"/>
        <Brand inverted />
        <div className="relative max-w-2xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400"/>AI-powered real estate workspace</div>
          <p className="text-xs font-semibold tracking-[0.24em] text-slate-400 uppercase">
            AI Real Estate Sales &amp; Reception
          </p>
          <h1 className="mt-5 max-w-xl text-5xl font-extrabold leading-[1.08] tracking-[-.05em] xl:text-6xl">
            Every lead. Every conversation. <span className="text-emerald-400">One workspace.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Properties, leads, customers and viewings—secured inside your agency workspace.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">{["AI Reception", "Lead CRM", "Secure data"].map((item) => <div className="rounded-2xl border border-white/10 bg-white/[.045] px-4 py-4 text-sm font-semibold text-slate-200 backdrop-blur" key={item}><span className="mb-3 block h-1.5 w-8 rounded-full bg-emerald-400"/>{item}</div>)}</div>
        </div>
        <p className="relative text-sm text-slate-500">One platform. Many agencies. Isolated data.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-[#f7f9fa] px-5 py-10 sm:px-10">
        <div className="w-full max-w-md rounded-[2rem] border border-slate-200/80 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,.10)] sm:p-10">
          <div className="mb-10 lg:hidden"><Brand /></div>
          {children}
        </div>
      </section>
    </main>
  );
}


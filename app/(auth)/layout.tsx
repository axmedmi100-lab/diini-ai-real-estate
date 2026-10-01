import type { ReactNode } from "react";

import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[1fr_34rem]">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 p-12 text-white lg:flex">
        <Brand inverted />
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-[0.2em] text-emerald-100 uppercase">
            AI Real Estate Sales &amp; Reception
          </p>
          <h1 className="mt-5 text-5xl font-bold leading-tight tracking-tight">
            Never lose a property lead again.
          </h1>
          <p className="mt-5 text-lg leading-8 text-emerald-50">
            Properties, leads, customers and viewings—secured inside your agency workspace.
          </p>
        </div>
        <p className="text-sm text-emerald-100">One platform. Many agencies. Isolated data.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-white px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><Brand /></div>
          {children}
        </div>
      </section>
    </main>
  );
}

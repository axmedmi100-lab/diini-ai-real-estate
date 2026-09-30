import { AppShell } from "@/components/layout/app-shell";

export default function Home() {
  return (
    <AppShell>
      <section className="mx-auto flex w-full max-w-5xl flex-1 items-center">
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-6 py-10 sm:px-10 sm:py-14">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-800 uppercase">
              Foundation ready
            </span>
            <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Never lose a property lead again.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              DIINI AI brings every agency&apos;s sales, reception, and lead
              workflow into one secure workspace.
            </p>
          </div>

          <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
            {[
              ["Multi-tenant", "Built for many independent agencies."],
              ["Secure by design", "Tenant isolation remains a core rule."],
              ["Channel ready", "Web, WhatsApp, and voice can connect later."],
            ].map(([title, description]) => (
              <article className="bg-white p-6" key={title}>
                <h2 className="font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

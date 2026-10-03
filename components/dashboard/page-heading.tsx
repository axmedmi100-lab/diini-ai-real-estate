import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-emerald-700 uppercase">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

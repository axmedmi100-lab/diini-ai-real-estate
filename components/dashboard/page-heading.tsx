import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 border-b border-slate-200/80 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-extrabold tracking-[0.2em] text-emerald-700 uppercase"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.035em] text-slate-950 sm:text-[2.55rem] sm:leading-tight">{title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}


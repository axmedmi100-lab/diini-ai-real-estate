type BrandProps = Readonly<{
  inverted?: boolean;
}>;

export function Brand({ inverted = false }: BrandProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[14px] bg-emerald-400 text-base font-black text-slate-950 shadow-[0_8px_24px_rgba(16,185,129,.24)]">
        <span className="absolute -right-2 -top-3 h-7 w-7 rounded-full bg-white/35" />
        <span className="relative">D</span>
      </span>
      <span className="leading-tight">
        <span
          className={`block text-sm font-bold tracking-wide ${
            inverted ? "text-white" : "text-slate-950"
          }`}
        >
          DIINI <span className="text-emerald-500">AI</span>
        </span>
        <span
          className={`block text-[0.65rem] font-medium tracking-[0.16em] uppercase ${
            inverted ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Real Estate
        </span>
      </span>
    </div>
  );
}


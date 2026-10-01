type BrandProps = Readonly<{
  inverted?: boolean;
}>;

export function Brand({ inverted = false }: BrandProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-lg font-black text-slate-950 shadow-sm">
        D
      </span>
      <span className="leading-tight">
        <span
          className={`block text-sm font-bold tracking-wide ${
            inverted ? "text-white" : "text-slate-950"
          }`}
        >
          DIINI AI
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

import Image from "next/image";

type BrandProps = Readonly<{
  inverted?: boolean;
  compact?: boolean;
  logoUrl?: string | null;
  name?: string;
  subtitle?: string;
}>;

export function Brand({ inverted = false, compact = false, logoUrl, name = "DIINI AI", subtitle = "Real Estate" }: BrandProps) {
  return (
    <div className="diini-brand group flex items-center gap-3" aria-label="DIINI AI Real Estate">
      <span className="diini-brand-mark relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[15px] shadow-[0_10px_28px_rgba(16,185,129,.24)]">
        {logoUrl ? <img alt={`${name} logo`} className="h-full w-full bg-white object-contain p-1" src={logoUrl} /> : <Image alt="" className="h-full w-full object-cover" height={44} priority src="/icons/diini-192.png" width={44} />}
        <span aria-hidden className="diini-brand-shine absolute inset-y-0 -left-8 w-5 rotate-12 bg-white/35 blur-sm" />
      </span>
      {!compact ? <span className="leading-tight">
        <span
          className={`block text-sm font-bold tracking-wide ${
            inverted ? "text-white" : "text-slate-950"
          }`}
        >
          {name}
        </span>
        <span
          className={`block text-[0.65rem] font-medium tracking-[0.16em] uppercase ${
            inverted ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {subtitle}
        </span>
      </span> : null}
    </div>
  );
}


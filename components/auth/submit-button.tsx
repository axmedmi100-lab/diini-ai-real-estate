"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: Readonly<{ children: React.ReactNode }>) {
  const { pending } = useFormStatus();

  return (
    <button
      className="mt-2 w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Fadlan sug..." : children}
    </button>
  );
}

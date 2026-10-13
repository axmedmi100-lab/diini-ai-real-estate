import Link from "next/link";

import { login } from "../actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { SubmitButton } from "@/components/auth/submit-button";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <>
      <p className="flex items-center gap-2 text-xs font-bold tracking-[.16em] text-emerald-700 uppercase"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>Ku soo dhowow</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-[-.04em] text-slate-950">Gal workspace-kaaga</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Maamul leads-ka, properties-ka iyo team-kaaga hal meel.</p>

      <form action={login} className="mt-8 space-y-5">
        <AuthMessage error={params.error} message={params.message} />
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100" name="email" placeholder="magaca@email.com" required type="email" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100" minLength={8} name="password" placeholder="••••••••" required type="password" />
        </label>
        <SubmitButton>Gal account-ka</SubmitButton>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        Agency cusub? <Link className="font-semibold text-emerald-700 hover:text-emerald-600" href="/signup">Samee account</Link>
      </p>
    </>
  );
}


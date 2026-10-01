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
      <p className="text-sm font-semibold text-emerald-700">Ku soo dhowow</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Gal workspace-kaaga</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Geli email-ka iyo password-ka agency-gaaga.</p>

      <form action={login} className="mt-8 space-y-5">
        <AuthMessage error={params.error} message={params.message} />
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" name="email" required type="email" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" minLength={8} name="password" required type="password" />
        </label>
        <SubmitButton>Gal account-ka</SubmitButton>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        Agency cusub? <Link className="font-semibold text-emerald-700 hover:text-emerald-600" href="/signup">Samee account</Link>
      </p>
    </>
  );
}

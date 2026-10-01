import Link from "next/link";

import { signup } from "../actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { SubmitButton } from "@/components/auth/submit-button";

type SignupPageProps = { searchParams: Promise<{ error?: string }> };

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;

  return (
    <>
      <p className="text-sm font-semibold text-emerald-700">Agency onboarding</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Abuur workspace-kaaga</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Account-ka ugu horreeya wuxuu noqonayaa Agency Owner.</p>

      <form action={signup} className="mt-7 space-y-4">
        <AuthMessage error={error} />
        <label className="block text-sm font-medium text-slate-700">Magacaaga
          <input autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" name="full_name" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">Magaca agency-ga
          <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" name="agency_name" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">Email
          <input autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" name="email" required type="email" />
        </label>
        <label className="block text-sm font-medium text-slate-700">Password
          <input autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" minLength={8} name="password" required type="password" />
        </label>
        <SubmitButton>Samee agency account</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">Account hore ma leedahay? <Link className="font-semibold text-emerald-700" href="/login">Gal</Link></p>
    </>
  );
}

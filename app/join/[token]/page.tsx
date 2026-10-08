import { notFound } from "next/navigation";

import { acceptExistingAccountInvite, signupInvitedMember } from "@/app/join/[token]/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { createClient } from "@/lib/supabase/server";

export default async function JoinAgencyPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error: pageError } = await searchParams;
  const supabase = await createClient();
  const [{ data: rows }, { data: { user } }] = await Promise.all([
    supabase.rpc("get_agency_invitation_preview", { raw_token: token }),
    supabase.auth.getUser(),
  ]);
  const invite = rows?.[0];
  if (!invite) notFound();
  return <div className="mx-auto min-h-screen max-w-xl px-5 py-16"><div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><p className="text-xs font-black tracking-widest text-emerald-700 uppercase">Agency invitation</p><h1 className="mt-3 text-3xl font-black text-slate-950">Ku biir {invite.agency_name}</h1><p className="mt-3 text-sm leading-6 text-slate-600"><strong>{invite.email}</strong> waxaa lagu casuumay role-ka <strong className="capitalize">{invite.role}</strong>.</p><div className="mt-6"><AuthMessage error={pageError} /></div>{user ? <form action={acceptExistingAccountInvite} className="mt-6"><input name="token" type="hidden" value={token} /><p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Waxaad ku jirtaa account <strong>{user.email}</strong>. Email-ku waa inuu la mid yahay email-ka la casuumay.</p><SubmitButton>Aqbal oo ku biir agency-ga</SubmitButton></form> : <form action={signupInvitedMember} className="mt-6 space-y-4"><input name="token" type="hidden" value={token} /><label className="block text-sm font-bold text-slate-700">Magacaaga<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" name="full_name" required /></label><label className="block text-sm font-bold text-slate-700">Email<input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3" name="email" readOnly type="email" value={invite.email} /></label><label className="block text-sm font-bold text-slate-700">Password<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" minLength={8} name="password" required type="password" /></label><SubmitButton>Samee account oo ku biir</SubmitButton></form>}</div></div>;
}

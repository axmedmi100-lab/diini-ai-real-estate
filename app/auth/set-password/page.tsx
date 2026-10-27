"use client";

import { type FormEvent, useEffect, useState } from "react";

import { Brand } from "@/components/layout/brand";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const verify = async () => {
      const setupType = new URLSearchParams(window.location.search).get("setup");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && (setupType === "invite" || setupType === "recovery")) {
        setAllowed(true);
        return;
      }
      window.location.replace("/login?error=Password setup link-ga ma shaqaynayo ama wuu dhacay.");
    };
    void verify();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");

    if (password.length < 8) {
      setError("Password-ku waa inuu ugu yaraan 8 xaraf ahaadaa.");
      return;
    }
    if (password !== confirmation) {
      setError("Labada password isku mid ma aha.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      setError("Password-ka lama kaydin. Dib uga fur link-ga email-ka ama isku day mar kale.");
      return;
    }

    const { data: isPlatformAdmin } = await supabase.rpc("is_platform_super_admin");
    window.location.replace(isPlatformAdmin ? "/admin" : "/dashboard");
  }

  if (!allowed) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <Brand />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Account setup</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Samee password-kaaga</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Samee password ammaan ah oo aad ku geli doonto workspace-kaaga.</p>
        {error ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
        <form className="mt-6 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-semibold text-slate-700">
            Password cusub
            <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" minLength={8} name="password" required type="password" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Ku celi password-ka
            <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" minLength={8} name="password_confirmation" required type="password" />
          </label>
          <button className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-60" disabled={saving} type="submit">
            {saving ? "Waa la kaydinayaa..." : "Kaydi oo gal workspace-ka"}
          </button>
        </form>
      </section>
    </main>
  );
}


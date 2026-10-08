"use client";

import { useState } from "react";

export function CopyInviteLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
  };
  return <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" onClick={copy} type="button">{copied ? "Waa la copy-gareeyey" : "Copy invite link"}</button>;
}

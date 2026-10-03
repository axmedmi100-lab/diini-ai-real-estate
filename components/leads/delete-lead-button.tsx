"use client";

import { useState } from "react";

export function DeleteLeadButton({ action, leadId }: { action: (formData: FormData) => Promise<void>; leadId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <button className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50" onClick={() => setConfirming(true)} type="button">Tirtir</button>;
  return <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3"><span className="text-xs font-bold text-rose-800">Ma hubtaa?</span><form action={action}><input name="lead_id" type="hidden" value={leadId} /><button className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white">Haa, tirtir</button></form><button className="rounded-lg bg-white px-3 py-2 text-xs font-bold" onClick={() => setConfirming(false)} type="button">Maya</button></div>;
}

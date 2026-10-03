"use client";

import { useState } from "react";

export function DeletePropertyButton({ action, propertyId }: { action: (formData: FormData) => Promise<void>; propertyId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <button className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50" onClick={() => setConfirming(true)} type="button">Tirtir</button>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
      <span className="text-xs font-semibold text-rose-800">Ma hubtaa?</span>
      <form action={action}><input name="property_id" type="hidden" value={propertyId} /><button className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white" type="submit">Haa, tirtir</button></form>
      <button className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700" onClick={() => setConfirming(false)} type="button">Maya</button>
    </div>
  );
}

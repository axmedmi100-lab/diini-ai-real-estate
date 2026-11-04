"use client";

import { useEffect, useState } from "react";

type Workspace = { id: string; name: string; logoUrl: string | null; role: string };

export function AgencySwitcher({ compact = false }: Readonly<{ compact?: boolean }>) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeAgencyId, setActiveAgencyId] = useState("");
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body: { workspaces?: Workspace[]; activeAgencyId?: string | null }) => {
        if (active) {
          setWorkspaces(body.workspaces ?? []);
          setActiveAgencyId(body.activeAgencyId ?? "");
        }
      })
      .catch(() => { if (active) setError("Agency-yada lama soo qaadi karin."); });
    return () => { active = false; };
  }, []);

  if (workspaces.length < 2) return null;

  async function switchWorkspace(agencyId: string) {
    if (agencyId === activeAgencyId) return;
    setSwitching(true);
    const previousAgencyId = activeAgencyId;
    setActiveAgencyId(agencyId);
    setError("");
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyId }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("Agency-ga lama beddeli karin.");
      setActiveAgencyId(previousAgencyId);
      setSwitching(false);
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <div className={compact ? "min-w-0" : "min-w-44"}>
      <label className="sr-only" htmlFor={compact ? "agency-switcher-mobile" : "agency-switcher"}>Dooro agency</label>
      <select
        aria-label="Dooro agency workspace"
        className={`w-full rounded-xl border bg-white text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${compact ? "max-w-36 px-2 py-2" : "px-3 py-2.5"}`}
        disabled={switching}
        id={compact ? "agency-switcher-mobile" : "agency-switcher"}
        onChange={(event) => void switchWorkspace(event.target.value)}
        value={activeAgencyId}
      >
        {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
      </select>
      {error ? <p className="mt-1 text-[10px] font-medium text-red-600">{error}</p> : null}
    </div>
  );
}


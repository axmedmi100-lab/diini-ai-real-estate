import { AuthMessage } from "@/components/auth/auth-message";

type Option = { id: string; label: string };
type Viewing = { id?: string; lead_id?: string; property_id?: string; agent_id?: string | null; starts_at?: string; status?: string; notes?: string | null };

function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ViewingForm({ action, viewing, leads, properties, agents, error }: { action: (formData: FormData) => Promise<void>; viewing?: Viewing; leads: Option[]; properties: Option[]; agents: Option[]; error?: string }) {
  const input = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  return <form action={action} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
    <AuthMessage error={error} />
    {viewing?.id ? <input name="viewing_id" type="hidden" value={viewing.id} /> : null}
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-700">Lead *<select className={input} defaultValue={viewing?.lead_id ?? ""} disabled={!!viewing?.id} name="lead_id" required><option value="">Dooro lead</option>{leads.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Property *<select className={input} defaultValue={viewing?.property_id ?? ""} disabled={!!viewing?.id} name="property_id" required><option value="">Dooro property</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Waqtiga *<input className={input} defaultValue={localDateTime(viewing?.starts_at)} name="starts_at" required type="datetime-local" /></label>
      <label className="text-sm font-semibold text-slate-700">Agent<select className={input} defaultValue={viewing?.agent_id ?? ""} name="agent_id"><option value="">Weli lama xilsaarin</option>{agents.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {viewing?.id ? <label className="text-sm font-semibold text-slate-700">Status<select className={input} defaultValue={viewing.status ?? "requested"} name="status">{["requested", "confirmed", "completed", "cancelled", "no_show"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label> : null}
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className={`${input} min-h-28`} defaultValue={viewing?.notes ?? ""} name="notes" /></label>
    </div>
    <button className="mt-7 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white" type="submit">{viewing?.id ? "Kaydi isbeddelka" : "Abuur viewing-ga"}</button>
  </form>;
}

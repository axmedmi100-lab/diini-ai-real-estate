import { AuthMessage } from "@/components/auth/auth-message";

type Lead = Record<string, unknown>;
type Agent = { id: string; label: string; role: string };

export function LeadForm({ action, agents, lead, error }: { action: (formData: FormData) => Promise<void>; agents: Agent[]; lead?: Lead; error?: string }) {
  const input = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  const furnished = lead?.furnished === true ? "true" : lead?.furnished === false ? "false" : "any";
  return (
    <form action={action} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <AuthMessage error={error} />
      {lead?.id ? <input name="lead_id" type="hidden" value={String(lead.id)} /> : null}
      <div className="mt-2 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Magaca<input className={input} defaultValue={String(lead?.name ?? "")} name="name" /></label>
        <label className="text-sm font-semibold text-slate-700">Phone<input className={input} defaultValue={String(lead?.phone ?? "")} name="phone" placeholder="+252..." /></label>
        <label className="text-sm font-semibold text-slate-700">Email<input className={input} defaultValue={String(lead?.email ?? "")} name="email" type="email" /></label>
        <label className="text-sm font-semibold text-slate-700">Source<select className={input} defaultValue={String(lead?.source ?? "manual")} name="source">{["website", "whatsapp", "phone", "facebook", "instagram", "manual", "referral", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Ujeeddo<select className={input} defaultValue={String(lead?.purpose ?? "")} name="purpose"><option value="">Lama cayimin</option><option value="rent">Kiro</option><option value="sale">Iib</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Degmada<input className={input} defaultValue={String(lead?.district ?? "")} name="district" /></label>
        <label className="text-sm font-semibold text-slate-700">Property type<select className={input} defaultValue={String(lead?.property_type ?? "")} name="property_type"><option value="">Nooc kasta</option>{["apartment", "house", "villa", "office", "shop", "land", "commercial", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Bedrooms<input className={input} defaultValue={String(lead?.bedrooms ?? "")} min="0" name="bedrooms" type="number" /></label>
        <label className="text-sm font-semibold text-slate-700">Minimum budget<input className={input} defaultValue={String(lead?.budget_min ?? "")} min="0" name="budget_min" step="0.01" type="number" /></label>
        <label className="text-sm font-semibold text-slate-700">Maximum budget<input className={input} defaultValue={String(lead?.budget_max ?? "")} min="0" name="budget_max" step="0.01" type="number" /></label>
        <label className="text-sm font-semibold text-slate-700">Furnished<select className={input} defaultValue={furnished} name="furnished"><option value="any">Mid kasta</option><option value="true">Haa</option><option value="false">Maya</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Status<select className={input} defaultValue={String(lead?.status ?? "new")} name="status">{["new", "qualified", "hot", "viewing", "negotiation", "won", "lost"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Agent-ka loo xilsaaray<select className={input} defaultValue={String(lead?.assigned_agent_id ?? "")} name="assigned_agent_id"><option value="">Weli lama xilsaarin</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label} — {agent.role}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className={`${input} min-h-36 resize-y`} defaultValue={String(lead?.notes ?? "")} name="notes" placeholder="Waxyaabaha uu rabo, wada hadalkii dhacay, iyo tallaabada xigta..." /></label>
      </div>
      <button className="mt-8 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800" type="submit">{lead ? "Kaydi lead-ka" : "Abuur lead-ka"}</button>
    </form>
  );
}

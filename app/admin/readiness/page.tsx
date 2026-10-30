import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeading } from "@/components/dashboard/page-heading";
import { getPlatformAdmin } from "@/lib/platform-admin";

type Check={key:string;category:string;title:string;status:"passed"|"warning"|"failed";detail:string};
type Readiness={score:number;overall_status:"ready"|"attention"|"blocked";checked_at:string;checks:Check[];summary:{passed:number;warning:number;failed:number;total:number}};
const styles={passed:"border-emerald-200 bg-emerald-50 text-emerald-900",warning:"border-amber-200 bg-amber-50 text-amber-900",failed:"border-red-200 bg-red-50 text-red-900"};

export default async function ReadinessPage(){
  const{user,supabase}=await getPlatformAdmin();
  const{data,error}=await supabase.rpc("get_platform_launch_readiness");
  const readiness=(data??{score:0,overall_status:"blocked",checked_at:new Date().toISOString(),checks:[],summary:{passed:0,warning:0,failed:1,total:1}}) as Readiness;
  return <AdminShell currentPath="/admin/readiness" userEmail={user.email}><div className="mx-auto max-w-7xl space-y-7"><PageHeading eyebrow="Production QA" title="Launch readiness" description="Live checks for security, workers, backups, integrations, billing and the complete real-estate workflow."/>
    {error?<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Readiness checks lama soo qaadi karin: {error.message}</p>:null}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><article className="rounded-2xl border bg-slate-950 p-5 text-white sm:col-span-2 xl:col-span-1"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Readiness score</p><p className="mt-2 text-4xl font-black">{readiness.score}%</p><p className="mt-2 text-xs uppercase text-slate-300">{readiness.overall_status}</p></article>{[["Passed",readiness.summary.passed,"text-emerald-700"],["Warning",readiness.summary.warning,"text-amber-700"],["Failed",readiness.summary.failed,"text-red-700"],["Total",readiness.summary.total,"text-slate-900"]].map(([label,value,color])=><article className="rounded-2xl border bg-white p-5" key={String(label)}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black ${color}`}>{value}</p></article>)}</section>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-5 py-4 text-sm"><p>Checked: <strong>{new Intl.DateTimeFormat("en",{dateStyle:"medium",timeStyle:"medium"}).format(new Date(readiness.checked_at))}</strong></p><a className="rounded-lg bg-slate-950 px-4 py-2 font-black text-white" href="/admin/readiness">Run checks again</a></div>
    <section className="grid gap-4 lg:grid-cols-2">{readiness.checks.map(check=><article className={`rounded-2xl border p-5 ${styles[check.status]}`} key={check.key}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] opacity-70">{check.category}</p><h2 className="mt-1 text-lg font-black">{check.title}</h2></div><span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase">{check.status}</span></div><p className="mt-3 text-sm opacity-80">{check.detail}</p></article>)}</section>
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6"><h2 className="text-lg font-black text-blue-950">Manual end-to-end QA</h2><p className="mt-2 text-sm text-blue-900">Marka failed checks-ku noqdaan 0, waxaan gacanta ku xaqiijinaynaa: AI Chat → Lead → Match → Viewing → Human agent → Customer → Transaction → Payment/PDF → Push/email.</p></section>
  </div></AdminShell>;
}


import Link from "next/link";
import { Brand } from "@/components/layout/brand";

export default function OfflinePage(){return <main className="grid min-h-screen place-items-center p-6"><section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-xl"><div className="flex justify-center"><Brand/></div><p className="mt-8 text-xs font-black uppercase tracking-widest text-amber-600">Offline</p><h1 className="mt-2 text-3xl font-black">Internet connection lama helin</h1><p className="mt-4 text-sm leading-6 text-slate-600">DIINI AI wuxuu u baahan yahay internet si uu u helo xogta agency-ga, AI iyo WhatsApp. Markuu internet-ku soo noqdo dib u fur dashboard-ka.</p><Link className="mt-7 inline-block rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white" href="/dashboard">Try again</Link></section></main>}


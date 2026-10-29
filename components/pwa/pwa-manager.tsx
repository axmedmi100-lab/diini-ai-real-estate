"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:"accepted"|"dismissed"}> };

export function PwaManager() {
  const [prompt,setPrompt]=useState<InstallPrompt|null>(null);
  const [offline,setOffline]=useState(false);
  const [updateReady,setUpdateReady]=useState(false);
  useEffect(()=>{
    setOffline(!navigator.onLine);
    const online=()=>setOffline(false); const offlineHandler=()=>setOffline(true);
    const install=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt);};
    window.addEventListener("online",online);window.addEventListener("offline",offlineHandler);window.addEventListener("beforeinstallprompt",install);
    if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").then((registration)=>{registration.addEventListener("updatefound",()=>{const worker=registration.installing;if(worker)worker.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)setUpdateReady(true);});});}).catch(()=>undefined);}
    return()=>{window.removeEventListener("online",online);window.removeEventListener("offline",offlineHandler);window.removeEventListener("beforeinstallprompt",install);};
  },[]);
  async function install(){if(!prompt)return;await prompt.prompt();await prompt.userChoice;setPrompt(null);}
  if(!offline&&!prompt&&!updateReady)return null;
  return <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white shadow-2xl" role="status"><p>{offline?"Internet-ka waa go'an. Data cusub lama heli karo.":updateReady?"Update cusub ayaa diyaar ah.":"DIINI AI ku rakib telefoonkaaga."}</p>{prompt&&!offline?<button className="shrink-0 rounded-lg bg-emerald-400 px-3 py-2 font-black text-slate-950" onClick={install}>Install</button>:null}{updateReady&&!offline?<button className="shrink-0 rounded-lg bg-emerald-400 px-3 py-2 font-black text-slate-950" onClick={()=>window.location.reload()}>Update</button>:null}</div>;
}


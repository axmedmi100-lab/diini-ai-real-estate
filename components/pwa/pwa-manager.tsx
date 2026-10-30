"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:"accepted"|"dismissed"}> };

export function PwaManager() {
  const [prompt,setPrompt]=useState<InstallPrompt|null>(null);
  const [offline,setOffline]=useState(false);
  const [updateReady,setUpdateReady]=useState(false);
  const [pushAvailable,setPushAvailable]=useState(false);
  const [pushBusy,setPushBusy]=useState(false);
  const [pushError,setPushError]=useState(false);
  useEffect(()=>{
    setOffline(!navigator.onLine);
    const online=()=>setOffline(false); const offlineHandler=()=>setOffline(true);
    const install=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt);};
    window.addEventListener("online",online);window.addEventListener("offline",offlineHandler);window.addEventListener("beforeinstallprompt",install);
    if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").then(async(registration)=>{registration.addEventListener("updatefound",()=>{const worker=registration.installing;if(worker)worker.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)setUpdateReady(true);});});const standalone=window.matchMedia("(display-mode: standalone)").matches;const existing=await registration.pushManager.getSubscription();if(existing){await fetch("/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(existing.toJSON())}).catch(()=>undefined);}setPushAvailable(standalone&&"Notification" in window&&Notification.permission!=="denied"&&!existing);}).catch(()=>undefined);}
    return()=>{window.removeEventListener("online",online);window.removeEventListener("offline",offlineHandler);window.removeEventListener("beforeinstallprompt",install);};
  },[]);
  async function install(){if(!prompt)return;await prompt.prompt();await prompt.userChoice;setPrompt(null);}
  async function enablePush(){setPushBusy(true);setPushError(false);try{const permission=await Notification.requestPermission();if(permission!=="granted"){setPushAvailable(false);return;}const registration=await navigator.serviceWorker.ready;const keyResponse=await fetch("/api/push/public-key",{cache:"no-store"});if(!keyResponse.ok)throw new Error("Push configuration unavailable");const{publicKey}=await keyResponse.json();const normalized=publicKey.replace(/-/g,"+").replace(/_/g,"/");const padded=normalized.padEnd(Math.ceil(normalized.length/4)*4,"=");const bytes=Uint8Array.from(atob(padded),(char)=>char.charCodeAt(0));const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});const response=await fetch("/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(subscription.toJSON())});if(!response.ok)throw new Error("Subscription save failed");setPushAvailable(false);}catch{setPushError(true);setPushAvailable(true);}finally{setPushBusy(false);}}
  if(!offline&&!prompt&&!updateReady&&!pushAvailable)return null;
  const message=offline?"Internet-ka waa go'an. Data cusub lama heli karo.":updateReady?"Update cusub ayaa diyaar ah.":pushError?"Push notification-ka lama xiriirin. Mar kale isku day.":pushAvailable?"Oggolow ogeysiisyada viewings, follow-ups iyo lacag-bixinta.":"DIINI AI ku rakib telefoonkaaga.";
  return <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white shadow-2xl" role="status"><p>{message}</p>{prompt&&!offline?<button className="shrink-0 rounded-lg bg-emerald-400 px-3 py-2 font-black text-slate-950" onClick={install}>Install</button>:null}{pushAvailable&&!offline?<button className="shrink-0 rounded-lg bg-emerald-400 px-3 py-2 font-black text-slate-950 disabled:opacity-60" disabled={pushBusy} onClick={enablePush}>{pushBusy?"Sug...":"Oggolow"}</button>:null}{updateReady&&!offline?<button className="shrink-0 rounded-lg bg-emerald-400 px-3 py-2 font-black text-slate-950" onClick={()=>window.location.reload()}>Update</button>:null}</div>;
}


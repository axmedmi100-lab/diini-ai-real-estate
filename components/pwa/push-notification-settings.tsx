"use client";

import { useEffect,useState } from "react";

type Status="loading"|"ready"|"connected"|"blocked"|"unsupported"|"error";

function applicationKey(publicKey:string){
  const normalized=publicKey.replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized.padEnd(Math.ceil(normalized.length/4)*4,"=");
  return Uint8Array.from(atob(padded),(char)=>char.charCodeAt(0));
}

async function saveSubscription(subscription:PushSubscription){
  const response=await fetch("/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(subscription.toJSON())});
  if(!response.ok)throw new Error("Subscription save failed");
}

export function PushNotificationSettings(){
  const[status,setStatus]=useState<Status>("loading");const[busy,setBusy]=useState(false);
  useEffect(()=>{(async()=>{if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){setStatus("unsupported");return;}if(Notification.permission==="denied"){setStatus("blocked");return;}try{const registration=await navigator.serviceWorker.ready;const subscription=await registration.pushManager.getSubscription();if(subscription){await saveSubscription(subscription);setStatus("connected");}else setStatus("ready");}catch{setStatus("error");}})();},[]);
  async function connect(){setBusy(true);try{const permission=await Notification.requestPermission();if(permission==="denied"){setStatus("blocked");return;}if(permission!=="granted"){setStatus("ready");return;}const keyResponse=await fetch("/api/push/public-key",{cache:"no-store"});if(!keyResponse.ok)throw new Error("Push configuration unavailable");const{publicKey}=await keyResponse.json();const registration=await navigator.serviceWorker.ready;const existing=await registration.pushManager.getSubscription();const subscription=existing??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(publicKey)});await saveSubscription(subscription);setStatus("connected");}catch{setStatus("error");}finally{setBusy(false);}}
  const copy=status==="connected"?"Telefoonkan wuxuu heli doonaa ogeysiisyo xitaa marka app-ku xiran yahay.":status==="blocked"?"Notifications-ka browser settings-ka ayaa laga xannibay. Site settings ka dhig Allow.":status==="unsupported"?"Browser-kan push notifications ma taageero.":status==="error"?"Xiriirinta push notification-ka way fashilantay. Mar kale isku day.":"Ku xir telefoonkan viewings, follow-ups, leads iyo billing alerts.";
  return <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Phone push</p><h2 className="mt-1 text-lg font-black text-slate-950">{status==="connected"?"Push notifications connected":"Push notifications"}</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">{copy}</p></div>{status==="ready"||status==="error"?<button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60" disabled={busy} onClick={connect}>{busy?"Connecting...":"Connect phone"}</button>:null}{status==="loading"?<span className="text-sm text-slate-500">Checking...</span>:null}{status==="connected"?<span className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">Connected</span>:null}</section>;
}


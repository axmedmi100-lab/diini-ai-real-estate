import webpush from "web-push";

export function configureWebPush() {
  const subject=process.env.VAPID_SUBJECT;
  const publicKey=process.env.VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  if(!subject||!publicKey||!privateKey)throw new Error("VAPID push configuration is incomplete.");
  webpush.setVapidDetails(subject,publicKey,privateKey);
  return {webpush,publicKey};
}

export function notificationUrl(entityType:string|null,entityId:string|null){
  const roots:Record<string,string>={lead:"/leads",viewing:"/viewings",conversation:"/conversations",follow_up:"/follow-ups",billing_invoice:"/billing"};
  const root=entityType?roots[entityType]:null;
  return root&&entityId?`${root}/${entityId}`:root||"/notifications";
}


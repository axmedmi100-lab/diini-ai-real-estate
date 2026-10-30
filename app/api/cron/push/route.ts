import { NextResponse } from "next/server";
import { configureWebPush,notificationUrl } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

function authorized(request:Request){const secret=process.env.CRON_SECRET;return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);}

async function run(request:Request){
  if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
  let webpush:ReturnType<typeof configureWebPush>["webpush"];try{webpush=configureWebPush().webpush;}catch{return NextResponse.json({error:"Push is not configured"},{status:503});}
  const supabase=createAdminClient();
  const{data:notifications,error}=await supabase.from("notifications").select("id,agency_id,user_id,type,title,body,entity_type,entity_id").is("push_processed_at",null).is("read_at",null).order("created_at",{ascending:true}).limit(50);
  if(error)return NextResponse.json({error:"Notification queue failed"},{status:500});
  let sent=0,failed=0,removed=0;
  for(const item of notifications??[]){
    const{data:claimed,error:claimError}=await supabase.from("notifications").update({push_processed_at:new Date().toISOString(),push_error:null}).eq("id",item.id).is("push_processed_at",null).select("id").maybeSingle();
    if(claimError||!claimed){failed++;continue;}
    let query=supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("agency_id",item.agency_id);
    if(item.user_id)query=query.eq("user_id",item.user_id);
    const{subscriptions}=await query.then(({data})=>({subscriptions:data??[]}));
    const errors:string[]=[];
    for(const subscription of subscriptions){
      try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_key}},JSON.stringify({title:item.title,body:item.body,tag:item.id,notificationId:item.id,url:notificationUrl(item.entity_type,item.entity_id)}),{TTL:3600});sent++;}
      catch(error){const status=typeof error==="object"&&error&&"statusCode" in error?Number(error.statusCode):0;if(status===404||status===410){await supabase.from("push_subscriptions").delete().eq("id",subscription.id);removed++;}else{failed++;errors.push(error instanceof Error?error.message:"Push failed");}}
    }
    if(errors.length)await supabase.from("notifications").update({push_error:errors.join("; ").slice(0,1000)}).eq("id",item.id);
  }
  return NextResponse.json({ok:true,processed:notifications?.length??0,sent,failed,removed});
}
export async function GET(request:Request){return run(request);}
export async function POST(request:Request){return run(request);}


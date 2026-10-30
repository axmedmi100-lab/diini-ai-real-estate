import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SubscriptionBody={endpoint?:string;keys?:{p256dh?:string;auth?:string}};

async function identity(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)return null;
  const[{data:membership},{data:isPlatformAdmin}]=await Promise.all([supabase.from("agency_members").select("agency_id").eq("user_id",user.id).eq("is_active",true).limit(1).maybeSingle(),supabase.rpc("is_platform_super_admin")]);
  return membership||isPlatformAdmin?{user,agencyId:membership?.agency_id??null,isPlatformAdmin:Boolean(isPlatformAdmin)}:null;
}

export async function POST(request:Request){
  const current=await identity();if(!current)return NextResponse.json({error:"Unauthorized"},{status:401});
  let body:SubscriptionBody;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid subscription"},{status:400});}
  if(!body.endpoint||!body.keys?.p256dh||!body.keys.auth||body.endpoint.length>2048)return NextResponse.json({error:"Invalid subscription"},{status:400});
  const admin=createAdminClient();
  const{error}=await admin.from("push_subscriptions").upsert({agency_id:current.agencyId,user_id:current.user.id,platform_admin:current.isPlatformAdmin,endpoint:body.endpoint,p256dh:body.keys.p256dh,auth_key:body.keys.auth,user_agent:request.headers.get("user-agent"),updated_at:new Date().toISOString()},{onConflict:"user_id,endpoint"});
  return error?NextResponse.json({error:"Subscription save failed"},{status:500}):NextResponse.json({ok:true});
}

export async function DELETE(request:Request){
  const current=await identity();if(!current)return NextResponse.json({error:"Unauthorized"},{status:401});
  let body:{endpoint?:string};try{body=await request.json();}catch{return NextResponse.json({error:"Invalid subscription"},{status:400});}
  if(!body.endpoint)return NextResponse.json({error:"Invalid subscription"},{status:400});
  await createAdminClient().from("push_subscriptions").delete().eq("user_id",current.user.id).eq("endpoint",body.endpoint);
  return NextResponse.json({ok:true});
}


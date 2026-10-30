import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request:Request){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  let body:{notificationId?:string};try{body=await request.json();}catch{return NextResponse.json({error:"Invalid notification"},{status:400});}
  if(!body.notificationId||!/^[0-9a-f-]{36}$/i.test(body.notificationId))return NextResponse.json({error:"Invalid notification"},{status:400});
  const{data:membership}=await supabase.from("agency_members").select("agency_id").eq("user_id",user.id).eq("is_active",true).limit(1).maybeSingle();
  if(!membership)return NextResponse.json({error:"Forbidden"},{status:403});
  const{error}=await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",body.notificationId).eq("agency_id",membership.agency_id).or(`user_id.is.null,user_id.eq.${user.id}`);
  return error?NextResponse.json({error:"Notification update failed"},{status:500}):NextResponse.json({ok:true});
}


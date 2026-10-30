import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function authorized(request:Request){const secret=process.env.CRON_SECRET;return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);}
async function run(request:Request){
  if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
  const{data,error}=await createAdminClient().rpc("process_platform_alerts");
  return error?NextResponse.json({error:"Platform alert monitor failed"},{status:500}):NextResponse.json({ok:true,result:data});
}
export async function GET(request:Request){return run(request);}
export async function POST(request:Request){return run(request);}


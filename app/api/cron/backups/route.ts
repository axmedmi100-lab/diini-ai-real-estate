import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const tables = [
  "agencies","user_profiles","agency_members","properties","customers","leads","conversations","messages","viewings","follow_ups","notifications","push_subscriptions","integrations","ai_settings","audit_logs",
  "platform_users","platform_audit_logs","agency_usage_monthly","platform_plans","agency_invitations","property_transactions","transaction_payments","property_occupancy_records",
  "agency_subscriptions","billing_invoices","manual_payment_requests","subscription_automation_events","platform_expenses","platform_integration_secrets",
] as const;

function authorized(request: Request) { const secret=process.env.CRON_SECRET; return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`); }
function validFilename(value:string|null){return value&&/^diini-backup-\d{4}-\d{2}-\d{2}\.bin$/.test(value)?value:null;}

async function readTable(supabase:ReturnType<typeof createAdminClient>,table:string){const rows:unknown[]=[];for(let from=0;;from+=1000){const{data,error}=await supabase.from(table).select("*").range(from,from+999);if(error)throw new Error(`${table}: ${error.message}`);rows.push(...(data??[]));if(!data||data.length<1000)break;}return rows;}

export async function GET(request:Request){
  if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
  const filename=validFilename(new URL(request.url).searchParams.get("filename"));
  if(!filename)return NextResponse.json({error:"Invalid filename"},{status:400});
  const secret=process.env.BACKUP_ENCRYPTION_KEY;
  if(!secret||secret.length<32)return NextResponse.json({error:"BACKUP_ENCRYPTION_KEY is missing or too short"},{status:503});
  const supabase=createAdminClient();
  try{
    const data:Record<string,unknown[]>={};let recordCount=0;
    for(const table of tables){data[table]=await readTable(supabase,table);recordCount+=data[table].length;}
    const users=[];for(let page=1;;page++){const{data:userPage,error}=await supabase.auth.admin.listUsers({page,perPage:1000});if(error)throw new Error(`auth_users: ${error.message}`);users.push(...userPage.users.map(user=>({id:user.id,email:user.email,phone:user.phone,created_at:user.created_at,last_sign_in_at:user.last_sign_in_at,email_confirmed_at:user.email_confirmed_at,user_metadata:user.user_metadata,app_metadata:user.app_metadata})));if(userPage.users.length<1000)break;}
    data.auth_users=users;recordCount+=users.length;
    const payload=Buffer.from(JSON.stringify({format:"diini-encrypted-backup-v1",generated_at:new Date().toISOString(),manifest:{tables:Object.fromEntries(Object.entries(data).map(([name,rows])=>[name,rows.length])),record_count:recordCount},data}));
    const key=createHash("sha256").update(secret).digest();const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",key,iv);const ciphertext=Buffer.concat([cipher.update(payload),cipher.final()]);const tag=cipher.getAuthTag();const encrypted=Buffer.concat([Buffer.from("DIINIBK1"),iv,tag,ciphertext]);
    await supabase.from("platform_backup_runs").upsert({filename,status:"generated",table_count:Object.keys(data).length,record_count:recordCount,byte_size:encrypted.length,error_message:null,generated_at:new Date().toISOString(),stored_at:null},{onConflict:"filename"});
    return new Response(encrypted,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="${filename}"`,"Content-Length":String(encrypted.length),"Cache-Control":"no-store"}});
  }catch(error){const message=error instanceof Error?error.message:"Backup failed";await supabase.from("platform_backup_runs").upsert({filename,status:"failed",error_message:message},{onConflict:"filename"});return NextResponse.json({error:"Backup generation failed"},{status:500});}
}

export async function POST(request:Request){if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});const filename=validFilename(new URL(request.url).searchParams.get("filename"));if(!filename)return NextResponse.json({error:"Invalid filename"},{status:400});const supabase=createAdminClient();const{data,error}=await supabase.from("platform_backup_runs").update({status:"stored",stored_at:new Date().toISOString()}).eq("filename",filename).eq("status","generated").select("id").maybeSingle();if(error||!data)return NextResponse.json({error:"Backup confirmation failed"},{status:409});return NextResponse.json({ok:true,filename});}


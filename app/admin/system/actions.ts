"use server";
import { revalidatePath } from "next/cache";
import { getPlatformAdmin } from "@/lib/platform-admin";

export async function acknowledgePlatformAlert(formData:FormData){
  const id=String(formData.get("alert_id")??"");
  if(!/^[0-9a-f-]{36}$/i.test(id))return;
  const{user,supabase}=await getPlatformAdmin();
  await supabase.from("platform_alerts").update({status:"acknowledged",acknowledged_at:new Date().toISOString(),acknowledged_by:user.id}).eq("id",id);
  revalidatePath("/admin/system");
}


import { NextResponse } from "next/server";
import { configureWebPush } from "@/lib/push";

export async function GET(){
  try{return NextResponse.json({publicKey:configureWebPush().publicKey},{headers:{"Cache-Control":"no-store"}});}
  catch{return NextResponse.json({error:"Push notifications are not configured."},{status:503});}
}


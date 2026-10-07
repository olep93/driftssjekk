import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request:Request){
  const url=new URL(request.url);
  const tokenHash=url.searchParams.get("token_hash");
  if(!tokenHash)return NextResponse.redirect(`${url.origin}/login?error=link`);
  const supabase=await createClient();
  const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:"recovery"});
  if(error)return NextResponse.redirect(`${url.origin}/login?error=link`);
  return NextResponse.redirect(`${url.origin}/nytt-passord`);
}

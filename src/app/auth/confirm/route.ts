import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request:Request){
  const url=new URL(request.url);
  const tokenHash=url.searchParams.get("token_hash");
  const type=url.searchParams.get("type");
  if(!tokenHash||(type!=="invite"&&type!=="recovery"))return NextResponse.redirect(`${url.origin}/login?error=link`);
  const supabase=await createClient();
  const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type});
  if(error)return NextResponse.redirect(`${url.origin}/login?error=link`);
  return NextResponse.redirect(`${url.origin}/nytt-passord`);
}

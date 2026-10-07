import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export default async function DraftLink({ reportId }: { reportId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("report_versions").select("id").eq("report_id", reportId).eq("state", "draft").maybeSingle();
  return data ? <Link className="button primary" href={`/rapporter/rediger/${data.id}`}>Fortsett redigering</Link> : null;
}

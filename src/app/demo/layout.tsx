import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth";

export default async function DemoLayout() {
  await getContext();
  redirect("/oversikt");
}

import { notFound } from "next/navigation";
import { DemoClient } from "../demo-client";

export default async function DemoSubpage({params}:{params:Promise<{slug:string[]}>}){
  const {slug}=await params;
  if(!slug.length||!["runder","rapporter","vurdering","kriterier"].includes(slug[0])||
    (slug[0]!=="rapporter"&&slug.length>1)||(slug.length>1&&((slug.length!==2&&slug.length!==3)||!Number.isInteger(Number(slug[1]))||Number(slug[1])<0||Number(slug[1])>2)))notFound();
  return <DemoClient/>;
}

import Link from "next/link";
import { PageHeading } from "@/components/ui";
import { CriteriaReference } from "@/components/criteria-reference";

export default function CriteriaPage() {
  return <>
    <div className="breadcrumb no-print"><Link href="/oversikt">Oversikt</Link> / Vurderingskriterier</div>
    <PageHeading eyebrow="Oppslagsverk" title="Vurderingskriterier" description="Originalmalen for uanmeldt konseptsjekk." />
    <CriteriaReference />
  </>;
}

import Link from "next/link";
import { formatScore } from "@/lib/scoring";
import { conceptBand, conceptLabel } from "@/lib/criteria";

export function Score({ value, neutral = false }: { value: number | null | undefined; neutral?: boolean }) {
  return <span className={`score-pill ${neutral ? "concept" : conceptBand(value)}`} title={neutral ? "Driftskarakter for intern progresjon" : conceptLabel(value)}>{formatScore(value)}</span>;
}
export function Status({ value }: { value: string }) {
  const labels: Record<string,string> = { planned:"Planlagt",active:"Pågår",closed:"Avsluttet",draft:"Kladd",published:"Publisert",open:"Åpent",in_progress:"Pågår",done:"Ferdig",withdrawn:"Trukket tilbake" };
  return <span className={`status ${value}`}>{labels[value] || value}</span>;
}
export function PageHeading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: React.ReactNode }) {
  return <header className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{children && <div className="page-actions">{children}</div>}</header>;
}
export function Empty({ title, description, href, action }: { title: string; description?: string; href?: string; action?: string }) {
  return <div className="empty"><h3>{title}</h3>{description && <p>{description}</p>}{href && action && <Link className="button primary" href={href}>{action}</Link>}</div>;
}

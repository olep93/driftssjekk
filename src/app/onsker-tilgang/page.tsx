import type { Metadata } from "next";
import Link from "next/link";
import AccessRequestForm from "./request-form";

export const metadata: Metadata = { title: "Ønsker tilgang | Driftssjekk" };

export default function AccessRequestPage() {
  return <main className="setup-page"><section className="setup-card access-request-card">
    <div className="brand"><span className="brand-icon">D</span><span>DRIFTSSJEKK</span></div>
    <p className="eyebrow">Tilgang</p><h1>Ønsker du tilgang?</h1>
    <p>Send en forespørsel til administrator. Du får ikke tilgang før administrator har opprettet konto og valgt rolle, samvirkelag og varehus.</p>
    <AccessRequestForm />
    <p className="small muted">Forespørselen åpnes i e-postprogrammet ditt. Du må sende e-posten derfra.</p>
    <Link className="text-button" href="/login">← Til innlogging</Link>
  </section></main>;
}

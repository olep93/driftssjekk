import { criteriaSections } from "@/lib/criteria";

export function CriteriaReference({ appendix = false }: { appendix?: boolean }) {
  return <section className={`criteria-reference ${appendix ? "criteria-appendix" : ""}`} aria-label="Vurderingskriterier">
    <div className="criteria-intro">
      <p className="eyebrow">Uanmeldt konseptsjekk</p>
      {appendix && <h2>Vurderingskriterier</h2>}
      <p>Skala fra 1 til 10. Karakter <strong>6 er konsept</strong>. Under 6 er under konsept, og over 6 er over konsept.</p>
      <div className="criteria-legend" aria-label="Konseptgrense">
        <span className="criteria-band below">Under 6 · Under konsept</span>
        <span className="criteria-band concept">6 · Konsept</span>
        <span className="criteria-band above">Over 6 · Over konsept</span>
      </div>
    </div>
    <div className="criteria-sections">
      {criteriaSections.map((section) => <section className="criteria-section" key={section.grade}>
        <h3>Karakter {section.grade}</h3>
        <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>
      </section>)}
    </div>
  </section>;
}

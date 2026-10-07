/** Transcribed from the assessment template supplied on 7 October 2026. */
export const criteriaVersion = "2026-10-07";

export const criteriaSections = [
  {
    grade: "1–2",
    points: [
      "Manglende renhold.",
      "Rot, søppel og tomemballasje i uteområder, gangbaner, på torg, i hyller og øvrige arealer.",
      "Stengt fremkommelighet: paller, varer eller emballasje stenger gangbaner og kjørebaner.",
      "Uorden eller usikret plassering av varer i høyden.",
      "Manglende prismerking og plakatering, samt manglende mekanisk kommunikasjon eller merking.",
      "Ikke gjennomførte spacer.",
      "Tomme hyller, reoler og torg.",
      "Manglende omtankesalg og salgsplasser.",
      "Manglende omtankesalg ved kassepunkt og manuelle punkter.",
      "Utstillinger er svært mangelfulle, skitne, støvete, skadet eller fremstår utdaterte.",
      "Medarbeidere er ikke synlige, eller kundene opplever lang kø og ventetid over tid.",
    ],
  },
  {
    grade: "3–5",
    points: [
      "Til dels rotete uttrykk ved stabling på torg, i hyller, reoler og på pall.",
      "Dårlig fremkommelighet i gangbaner, kjørefelt og parkeringsfelt.",
      "Dårlig eller mangelfull prismerking og plakatering.",
      "Mangelfulle spacer.",
      "Lav fyllingsgrad på torg, mangelfullt varetrykk og manglende fylling eller fremtrekk i hyller og på pigger.",
      "Rot i reoler på Drive-In.",
      "Mangelfull gjennomføring av omtankesalg.",
      "Utstillinger fremstår rotete, er ikke rengjort eller mangler prismerking og brosjyremateriell.",
      "Bemanning er ikke optimal i forhold til kundetrykk, blikk og smil.",
    ],
  },
  {
    grade: "6–8",
    points: [
      "Avdeling eller varehus har ingen strukturelle utfordringer.",
      "Ryddig og ordentlig inntrykk av varehuset ute, i butikk, på Drive-In og i varemottak.",
      "Ryddige gangbaner og kjørebaner, og rette torg.",
      "Torg, paller, hyller og reoler fremstår velfylte og selgende.",
      "Innstikkreoler og grenreoler er ryddige og velfylte.",
      "Prismerking og plakatering er godt ivaretatt.",
      "Mekanisk kommunikasjon og annen relevant informasjon, som medlemsmateriell og kundeavis, er synlig og tilgjengelig.",
      "Utstillinger fremstår oppdaterte, rene, ryddige og selgende.",
      "Omtankesalg med naturlig tilhørende produkter er velfylt og prismerket.",
      "Medarbeidere er tilgjengelige og bruker enhetlig arbeidstøy og navneskilt.",
    ],
  },
  {
    grade: "9",
    points: [
      "Gjennomgående orden, ryddighet og renhold.",
      "Utmerket varetrykk. Prismerking, plakater, mekanisk og annen informasjon er godt ivaretatt.",
      "Svært selgende uttrykk og kampanjetrykk.",
      "Rette torg, svært god fyllingsgrad og passelig høyde på torg.",
      "Varer er trukket frem i hyller og på pigger.",
      "Gjennomgående svært ryddig Drive-In, med ryddige og sikrede reoler, palletorg og varer i høyden.",
      "Varemottak med 5S.",
      "Synlige og oppmerksomme medarbeidere med god kompetanse, dersom dette er mulig å vurdere.",
    ],
  },
  {
    grade: "10",
    points: [
      "Det skinner! Varehuset fremstår i en standard over det som kan forventes med tanke på konseptgjennomføring, struktur, orden og ryddighet.",
    ],
  },
] as const;

export type ConceptBand = "below" | "concept" | "above" | "unrated";
export function conceptBand(value: number | null | undefined): ConceptBand {
  if (value == null || !Number.isFinite(value)) return "unrated";
  if (value < 6) return "below";
  if (value > 6) return "above";
  return "concept";
}

export function conceptLabel(value: number | null | undefined): string {
  const band = conceptBand(value);
  return band === "below" ? "Under konsept" : band === "above" ? "Over konsept" : band === "concept" ? "Konsept" : "Ikke vurdert";
}

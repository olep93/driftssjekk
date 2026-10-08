export function reportKindLabel(kind: string, eventId?: string | null) {
  return eventId || kind === "event_check" ? "Konseptrunde på samling"
    : kind === "inspection" ? "Uanmeldt konseptsjekk" : "Månedlig driftsgjennomgang";
}

export function reportKindLabelUpper(kind: string, eventId?: string | null) {
  return reportKindLabel(kind, eventId).toLocaleUpperCase("nb-NO");
}

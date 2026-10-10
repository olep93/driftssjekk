import path from "node:path";
// Renamed so the HTML alt-text lint rule does not treat PDF images as <img> elements.
import { Document, Font, Image as PdfImage, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { conceptBand, conceptLabel, criteriaSections } from "../criteria";
import { formatDate, formatScore } from "../scoring";
import { balanceColumns, fitPhoto, marginX, photoGap, photoLayout, summaryHeadline, type PeerComparison } from "./layout";

const fonts = path.join(process.cwd(), "src/lib/report-template/fonts");
Font.register({ family: "Archivo", fonts: [
  { src: path.join(fonts, "archivo-latin-600-normal.woff"), fontWeight: 600 },
  { src: path.join(fonts, "archivo-latin-800-normal.woff"), fontWeight: 800 },
] });
Font.register({ family: "Plex", fonts: [
  { src: path.join(fonts, "ibm-plex-sans-latin-400-normal.woff"), fontWeight: 400 },
  { src: path.join(fonts, "ibm-plex-sans-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
  { src: path.join(fonts, "ibm-plex-sans-latin-500-normal.woff"), fontWeight: 500 },
  { src: path.join(fonts, "ibm-plex-sans-latin-600-normal.woff"), fontWeight: 600 },
] });
// The default hyphenation is English and splits Norwegian words in odd places.
Font.registerHyphenationCallback((word) => [word]);

/** Neutral profile: graphite ink with a steel-blue accent. Green and red only ever mean above or below concept. */
export const tokens = {
  ink: "#1d2836", muted: "#647184", faint: "#8b96a5", line: "#e1e6eb", soft: "#f3f5f7", accent: "#2f6b86",
  good: "#256d52", goodSoft: "#e2f0e9", bad: "#ac453d", badSoft: "#f7e4e2", mid: "#33475c", midSoft: "#e7ecf1", flag: "#9a5a12", flagSoft: "#fbefdf",
};
const bandColor = (score: number | null) => { const band = conceptBand(score); return band === "above" ? tokens.good : band === "below" ? tokens.bad : tokens.mid; };
const bandSoft = (score: number | null) => { const band = conceptBand(score); return band === "above" ? tokens.goodSoft : band === "below" ? tokens.badSoft : tokens.midSoft; };
// Captions are clipped so one long caption cannot push a row of photos onto the next page.
export const clip = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
export const statusLabel: Record<string, string> = { open: "Åpen", in_progress: "Under arbeid", done: "Utført" };

export type ReportPhoto = { data: Buffer; width: number; height: number; caption: string };
export type ReportArea = { key: string; label: string; score: number | null; comment: string; needsFollowUp: boolean; photos: ReportPhoto[] };
export type ReportTask = { area: string; description: string; dueDate: string | null; status: string; photo: ReportPhoto | null };
export type ReportDocumentData = {
  kind: "inspection" | "self_check" | "event_check"; kindLabel: string;
  storeName: string; cooperativeName: string; roundTitle: string | null; visitDate: string; assessorName: string; versionNo: number;
  total: number | null; partial: boolean; summary: string; strengths: string[]; improvements: string[];
  previousTotal: number | null; peer: PeerComparison | null; history: { date: string; total: number }[];
  areas: ReportArea[]; tasks: ReportTask[];
};

export const s = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 9.5, color: tokens.ink, paddingTop: 62, paddingBottom: 58, paddingHorizontal: marginX },
  header: { position: "absolute", top: 26, left: marginX, right: marginX, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: tokens.faint, letterSpacing: 0.6, textTransform: "uppercase" },
  footer: { position: "absolute", bottom: 26, left: marginX, right: marginX, fontSize: 7.5, color: tokens.faint, borderTopWidth: 0.6, borderTopColor: tokens.line, paddingTop: 7 },
  // react-pdf drops render-prop text when the page sets lineHeight, so line height lives on the text styles.
  pageNumber: { position: "absolute", bottom: 26, left: marginX, right: marginX, paddingTop: 7.6, textAlign: "right", fontSize: 7.5, color: tokens.faint },
  brand: { fontFamily: "Archivo", fontWeight: 800, color: tokens.ink, letterSpacing: 1.4 },
  eyebrow: { fontSize: 7.5, fontWeight: 600, color: tokens.accent, letterSpacing: 1, textTransform: "uppercase" },
  h1: { fontFamily: "Archivo", fontWeight: 800, fontSize: 30, lineHeight: 1.05, letterSpacing: -0.3 },
  h2: { fontFamily: "Archivo", fontWeight: 800, fontSize: 19, lineHeight: 1.12 },
  h3: { fontFamily: "Archivo", fontWeight: 600, fontSize: 11.5 },
  sub: { fontSize: 9.5, color: tokens.muted },
  label: { fontSize: 7, fontWeight: 600, color: tokens.muted, letterSpacing: 0.9, textTransform: "uppercase" },
  big: { fontFamily: "Archivo", fontWeight: 800, fontSize: 58, lineHeight: 0.9, letterSpacing: -1 },
  pill: { fontSize: 8, fontWeight: 600, borderRadius: 9, paddingVertical: 3, paddingHorizontal: 8, alignSelf: "flex-start" },
  body: { fontSize: 10, lineHeight: 1.55 },
  small: { fontSize: 8, color: tokens.muted, lineHeight: 1.4 },
  rule: { height: 1.2, backgroundColor: tokens.ink, marginVertical: 14 },
});

export function Chrome({ label, storeName, date }: { label: string; storeName: string; date: string }) {
  return <>
    <View style={s.header} fixed><Text style={s.brand}>DRIFTSSJEKK</Text><Text>{label}</Text></View>
    <View style={s.footer} fixed><Text>{storeName} · {date}</Text></View>
    <Text style={s.pageNumber} fixed render={({ pageNumber, totalPages }) => `Side ${pageNumber} av ${totalPages}`} />
  </>;
}

function ScaleBar({ score }: { score: number | null }) {
  const at = (value: number) => `${((value - 1) / 9) * 100}%`;
  return <View>
    <View style={{ height: 7, borderRadius: 4, flexDirection: "row", overflow: "hidden" }}>
      <View style={{ width: at(6), backgroundColor: "#f0d6d2" }} /><View style={{ flexGrow: 1, backgroundColor: "#d6e9df" }} />
    </View>
    <View style={{ position: "absolute", left: at(6), top: -3, width: 1.2, height: 13, backgroundColor: tokens.ink }} />
    {score !== null && <View style={{ position: "absolute", left: at(score), top: -2.5, width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: tokens.ink, borderWidth: 2.5, borderColor: "#ffffff" }} />}
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
      <Text style={s.small}>1</Text><Text style={s.small}>6 = konsept</Text><Text style={s.small}>10</Text>
    </View>
  </View>;
}

function comparisonText(data: ReportDocumentData) {
  const parts: string[] = [];
  if (data.previousTotal !== null && data.total !== null) {
    const delta = data.total - data.previousTotal;
    parts.push(Math.abs(delta) < 0.005 ? "Samme som forrige konseptsjekk" : `${delta > 0 ? "+" : "−"}${formatScore(Math.abs(delta))} siden forrige konseptsjekk`);
  }
  if (data.peer) parts.push(data.peer === "above" ? "Over snittet i samvirkelaget" : data.peer === "below" ? "Under snittet i samvirkelaget" : "På snittet i samvirkelaget");
  return parts;
}

function SummaryPage({ data }: { data: ReportDocumentData }) {
  const selfCheck = data.kind === "self_check";
  const headline = summaryHeadline(data.kind, data.total, data.areas);
  const comparisons = selfCheck ? [] : comparisonText(data);
  const totalColor = selfCheck ? tokens.ink : bandColor(data.total);
  return <View>
    <Text style={s.eyebrow}>{[data.cooperativeName, data.roundTitle].filter(Boolean).join(" · ")}</Text>
    <Text style={[s.h1, { marginTop: 6 }]}>{data.storeName}</Text>
    <Text style={[s.sub, { marginTop: 6 }]}>Besøk {formatDate(data.visitDate)} · Vurdert av {data.assessorName || "ukjent"}{data.versionNo > 1 ? ` · Versjon ${data.versionNo}` : ""}</Text>

    <View style={{ marginTop: 22, backgroundColor: tokens.soft, borderRadius: 8, padding: 18, flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: 150 }}>
        <Text style={s.label}>{selfCheck ? "Driftskarakter" : data.partial ? "Delvurdering" : "Totalkarakter"}</Text>
        <Text style={[s.big, { color: totalColor, marginTop: 6 }]}>{formatScore(data.total)}</Text>
      </View>
      <View style={{ flexGrow: 1, flexBasis: 0, marginLeft: 12 }}>
        {selfCheck
          ? <Text style={[s.pill, { backgroundColor: tokens.midSoft, color: tokens.mid }]}>Intern progresjon · teller ikke i konseptrangeringen</Text>
          : <Text style={[s.pill, { backgroundColor: bandSoft(data.total), color: bandColor(data.total) }]}>{conceptLabel(data.total)}</Text>}
        {comparisons.map((line) => <Text key={line} style={[s.small, { marginTop: 5, color: tokens.ink }]}>{line}</Text>)}
        {!selfCheck && <View style={{ marginTop: 14 }}><ScaleBar score={data.total} /></View>}
      </View>
    </View>

    <Text style={[s.h2, { marginTop: 24 }]}>{headline}</Text>
    <View style={{ marginTop: 10 }}>
      {data.areas.map((area) => {
        const width = area.score === null ? 0 : ((area.score - 1) / 9) * 100;
        return <View key={area.key} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.6, borderBottomColor: tokens.line }}>
          <Text style={{ width: 110, fontWeight: 600, fontSize: 10.5 }}>{area.label}</Text>
          <View style={{ flexGrow: 1, height: 6, borderRadius: 3, backgroundColor: tokens.soft, marginRight: 16 }}>
            <View style={{ width: `${width}%`, height: 6, borderRadius: 3, backgroundColor: selfCheck ? tokens.accent : bandColor(area.score) }} />
            {!selfCheck && <View style={{ position: "absolute", left: `${(5 / 9) * 100}%`, top: -3, width: 1, height: 12, backgroundColor: tokens.ink, opacity: 0.5 }} />}
          </View>
          <Text style={{ width: 44, textAlign: "right", fontFamily: "Archivo", fontWeight: 800, fontSize: 14, color: selfCheck ? tokens.ink : bandColor(area.score) }}>{formatScore(area.score)}</Text>
        </View>;
      })}
    </View>

    {(data.strengths.length > 0 || data.improvements.length > 0) && <View style={{ flexDirection: "row", marginTop: 18 }}>
      {[{ title: "Styrker", items: data.strengths, color: tokens.good }, { title: "Forbedringer", items: data.improvements, color: tokens.bad }].filter((box) => box.items.length).map((box, index) =>
        <View key={box.title} style={{ flexGrow: 1, flexBasis: 0, marginLeft: index ? 12 : 0, backgroundColor: tokens.soft, borderRadius: 6, padding: 12 }}>
          <Text style={[s.label, { color: box.color }]}>{box.title}</Text>
          {box.items.map((item) => <View key={item} style={{ flexDirection: "row", marginTop: 5 }}><Text style={{ width: 9, color: box.color }}>•</Text><Text style={{ flexGrow: 1, flexBasis: 0 }}>{item}</Text></View>)}
        </View>)}
    </View>}

    <View style={{ marginTop: 18 }}>
      <Text style={s.label}>Oppsummering</Text>
      <Text style={[s.body, { marginTop: 5 }]}>{data.summary || "Ingen samlet kommentar."}</Text>
    </View>
  </View>;
}

export function PhotoGrid({ photos, width }: { photos: ReportPhoto[]; width?: number }) {
  const layout = photoLayout(photos.length, width);
  return <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 14 }}>
    {photos.map((photo, index) => {
      const fitted = fitPhoto(photo.width, photo.height, layout.cellWidth, layout.cellHeight);
      const lastInRow = (index + 1) % layout.columns === 0;
      return <View key={index} wrap={false} style={{ width: layout.cellWidth, marginRight: lastInRow ? 0 : photoGap, marginBottom: 12 }}>
        <View style={{ width: layout.cellWidth, height: layout.cellHeight, backgroundColor: tokens.soft, borderRadius: 4, alignItems: "center", justifyContent: "center" }}>
          <PdfImage src={{ data: photo.data, format: "jpg" }} style={{ width: fitted.width, height: fitted.height }} />
          <Text style={{ position: "absolute", left: 6, top: 6, fontSize: 7, fontWeight: 600, backgroundColor: "#ffffff", color: tokens.ink, paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3 }}>{index + 1}</Text>
        </View>
        {photo.caption ? <Text style={[s.small, { marginTop: 4 }]}>{clip(photo.caption, layout.columns === 3 ? 110 : 220)}</Text> : null}
      </View>;
    })}
  </View>;
}

function AreaSection({ data, area, index, count }: { data: ReportDocumentData; area: ReportArea; index: number; count: number }) {
  const selfCheck = data.kind === "self_check";
  const color = selfCheck ? tokens.ink : bandColor(area.score);
  return <View break>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }} minPresenceAhead={160}>
      <View>
        <Text style={s.eyebrow}>Område {index + 1} av {count}</Text>
        <Text style={[s.h1, { marginTop: 4 }]}>{area.label}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.big, { fontSize: 44, color }]}>{formatScore(area.score)}</Text>
        {!selfCheck && <Text style={[s.pill, { marginTop: 6, alignSelf: "flex-end", backgroundColor: bandSoft(area.score), color }]}>{conceptLabel(area.score)}</Text>}
      </View>
    </View>
    <View style={s.rule} />
    <Text style={s.label}>Vurdering</Text>
    <Text style={[s.body, { marginTop: 5 }]}>{area.comment || "Ingen kommentar."}</Text>
    {area.needsFollowUp && <Text style={[s.pill, { marginTop: 10, backgroundColor: tokens.flagSoft, color: tokens.flag }]}>Krever oppfølging</Text>}
    {area.photos.length > 0 && <View style={{ marginTop: 18 }}>
      <Text style={s.label}>Bilder · {area.photos.length}</Text>
      <PhotoGrid photos={area.photos} />
    </View>}
  </View>;
}

function TasksAndTrend({ data }: { data: ReportDocumentData }) {
  const showTrend = data.kind !== "self_check" && data.history.length > 1;
  if (!data.tasks.length && !showTrend) return null;
  const max = 10;
  return <View break>
    {data.tasks.length > 0 && <View>
      <Text style={s.eyebrow}>Tiltak</Text>
      <Text style={[s.h2, { marginTop: 4, marginBottom: 8 }]}>{data.tasks.length === 1 ? "Én oppgave til varehuset" : `${data.tasks.length} oppgaver til varehuset`}</Text>
      {data.tasks.map((task, index) => {
        const tone = task.status === "done" ? [tokens.goodSoft, tokens.good] : task.status === "in_progress" ? [tokens.flagSoft, tokens.flag] : [tokens.midSoft, tokens.mid];
        return <View key={index} wrap={false} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 9, borderBottomWidth: 0.6, borderBottomColor: tokens.line }}>
          <View style={{ width: 46, height: 46, borderRadius: 4, backgroundColor: tokens.soft, marginRight: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {task.photo && <PdfImage src={{ data: task.photo.data, format: "jpg" }} style={fitPhoto(task.photo.width, task.photo.height, 46, 46)} />}
          </View>
          <View style={{ flexGrow: 1, flexBasis: 0 }}>
            <Text style={{ fontWeight: 600, fontSize: 10 }}>{task.description}</Text>
            <Text style={[s.small, { marginTop: 2 }]}>{task.area} · {task.dueDate ? `Frist ${formatDate(task.dueDate)}` : "Ingen frist"}</Text>
          </View>
          <Text style={[s.pill, { marginLeft: 10, backgroundColor: tone[0], color: tone[1] }]}>{statusLabel[task.status] || task.status}</Text>
        </View>;
      })}
    </View>}
    {showTrend && <View wrap={false} style={{ marginTop: data.tasks.length ? 28 : 0 }}>
      <Text style={s.eyebrow}>Utvikling</Text>
      <Text style={[s.h2, { marginTop: 4 }]}>Konseptsjekker i varehuset</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, marginTop: 24, borderBottomWidth: 0.8, borderBottomColor: tokens.line }}>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 60, borderTopWidth: 0.8, borderTopColor: tokens.ink, borderStyle: "dashed", opacity: 0.45 }} />
        {data.history.map((point, index) => {
          const current = index === data.history.length - 1;
          return <View key={point.date} style={{ flexGrow: 1, flexBasis: 0, marginLeft: index ? 10 : 0, alignItems: "center" }}>
            <Text style={[s.small, { color: current ? tokens.ink : tokens.muted, fontWeight: current ? 600 : 400, marginBottom: 3 }]}>{formatScore(point.total)}</Text>
            <View style={{ width: "70%", height: (point.total / max) * 100, backgroundColor: current ? tokens.accent : "#c9d3dd", borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
          </View>;
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 5 }}>
        {data.history.map((point, index) => <Text key={point.date} style={[s.small, { flexGrow: 1, flexBasis: 0, marginLeft: index ? 10 : 0, textAlign: "center" }]}>{formatDate(point.date)}</Text>)}
      </View>
      <Text style={[s.small, { marginTop: 8 }]}>Stiplet linje viser konsept (karakter 6). Søylene starter på 0.</Text>
    </View>}
  </View>;
}

function Criteria() {
  const [left, right] = balanceColumns(criteriaSections);
  const gradeColor = (grade: string) => grade === "1–2" || grade === "3–5" ? tokens.bad : grade === "9" || grade === "10" ? tokens.good : tokens.mid;
  const column = (sections: (typeof criteriaSections)[number][]) => <View style={{ flexGrow: 1, flexBasis: 0 }}>
    {sections.map((section) => <View key={section.grade} style={{ marginBottom: 12 }}>
      <Text style={{ fontFamily: "Archivo", fontWeight: 600, fontSize: 10.5, color: gradeColor(section.grade), borderTopWidth: 0.6, borderTopColor: tokens.line, paddingTop: 6 }}>Karakter {section.grade}</Text>
      {section.points.map((point) => <View key={point} style={{ flexDirection: "row", marginTop: 3 }}><Text style={{ width: 8, fontSize: 7.6, color: tokens.faint }}>•</Text><Text style={{ flexGrow: 1, flexBasis: 0, fontSize: 7.6, lineHeight: 1.38 }}>{point}</Text></View>)}
    </View>)}
  </View>;
  return <View break>
    <Text style={s.eyebrow}>Vedlegg</Text>
    <Text style={[s.h2, { marginTop: 4 }]}>Vurderingskriterier</Text>
    <Text style={[s.small, { marginTop: 4, marginBottom: 14 }]}>Skala 1–10. Karakter 6 er konsept. Under 6 er under konsept, over 6 er over konsept.</Text>
    <View style={{ flexDirection: "row" }}>{column(left)}<View style={{ width: 20 }} />{column(right)}</View>
  </View>;
}

export function ReportDocument({ data }: { data: ReportDocumentData }) {
  return <Document title={`${data.storeName} – ${data.kindLabel}`} author="Driftssjekk" language="nb-NO">
    <Page size="A4" style={s.page}>
      <Chrome label={data.kindLabel} storeName={data.storeName} date={formatDate(data.visitDate)} />
      <SummaryPage data={data} />
      {data.areas.map((area, index) => <AreaSection key={area.key} data={data} area={area} index={index} count={data.areas.length} />)}
      <TasksAndTrend data={data} />
      {data.kind !== "self_check" && <Criteria />}
    </Page>
  </Document>;
}

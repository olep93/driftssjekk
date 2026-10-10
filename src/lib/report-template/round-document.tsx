import { Document, Line, Page, Rect, Svg, Text, View } from "@react-pdf/renderer";
import { conceptBand } from "../criteria";
import { areas, formatDate, formatScore } from "../scoring";
import type { RoundReportData } from "../round-report";
import { contentWidth } from "./layout";
import { Kpi } from "./progress-document";
import { Chrome, s, tokens } from "./report-document";

const signed = (value: number | null) => value === null ? "—" : Math.abs(value) < 0.005 ? "±0,00" : `${value > 0 ? "+" : "−"}${formatScore(Math.abs(value))}`;
const deltaColor = (value: number | null) => value === null || Math.abs(value) < 0.005 ? tokens.muted : value > 0 ? tokens.good : tokens.bad;
const band = (score: number | null) => { const value = conceptBand(score); return value === "above" ? tokens.good : value === "below" ? tokens.bad : tokens.mid; };
/** "Konseptsjekk august 2026" reads as "august 2026" in tables. */
export const shortRound = (title: string) => title.replace(/^konseptsjekk\s+/i, "");
/** Imported history carries a fixed note instead of a real summary; it is left out of the store pages. */
const realSummary = (summary: string) => summary && !summary.startsWith("Historisk import") ? summary : "";

function Bar({ score, width }: { score: number | null; width: number }) {
  const fill = score === null ? 0 : Math.max(0.015, (score - 1) / 9);
  return <View style={{ width, height: 7, borderRadius: 3.5, backgroundColor: tokens.soft }}>
    <View style={{ width: width * fill, height: 7, borderRadius: 3.5, backgroundColor: band(score) }} />
    <View style={{ position: "absolute", left: width * 5 / 9 - 0.6, top: -3, width: 1.2, height: 13, backgroundColor: tokens.ink }} />
  </View>;
}

function HistoryChart({ history }: { history: RoundReportData["summary"]["history"] }) {
  const width = contentWidth, height = 120, bottom = 18, top = 14, slot = width / history.length, barWidth = Math.min(46, slot * 0.5);
  const scored = history.map((item) => item.average).filter((value): value is number => value !== null);
  const min = Math.min(4, Math.floor(Math.min(...scored, 6) - 0.5));
  const y = (value: number) => top + (10 - value) / (10 - min) * (height - top - bottom);
  return <Svg width={width} height={height}>
    <Line x1={0} x2={width} y1={y(6)} y2={y(6)} stroke="#8f9aa8" strokeWidth={0.8} strokeDasharray="4 3" />
    <Line x1={0} x2={width} y1={height - bottom} y2={height - bottom} stroke={tokens.line} strokeWidth={0.8} />
    {history.map((item, index) => {
      const center = index * slot + slot / 2, current = index === history.length - 1;
      return [
        item.average !== null ? <Rect key={`b${index}`} x={center - barWidth / 2} y={y(item.average)} width={barWidth} height={height - bottom - y(item.average)} fill={current ? tokens.accent : "#c9d3dd"} /> : null,
        item.average !== null ? <Text key={`v${index}`} x={center} y={y(item.average) - 4} textAnchor="middle" style={{ fontFamily: current ? "Display" : "Mono", fontWeight: current ? 700 : 500, fontSize: current ? 9 : 7, fill: tokens.ink }}>{formatScore(item.average)}</Text> : null,
        <Text key={`l${index}`} x={center} y={height - 5} textAnchor="middle" style={{ fontFamily: "Mono", fontSize: 6.5, fill: tokens.muted }}>{shortRound(item.title)}</Text>,
      ];
    })}
  </Svg>;
}

/** Round report: ranking, the areas across stores, development over rounds and one section per store. */
export function RoundDocument({ data, today }: { data: RoundReportData; today: string }) {
  const { summary } = data, { round } = summary;
  const dates = [round.from, round.to].filter(Boolean).map((date) => formatDate(date)).join(" – ");
  const columns = { rank: 34, store: 128, total: 46, area: 52, delta: 50 };
  return <Document title={`${round.title} – runderapport`} author="Driftssjekk" language="nb-NO">
    <Page size="A4" style={s.page}>
      <Chrome label="Runderapport" storeName={data.cooperativeName} date={shortRound(round.title)} />
      <Text style={s.eyebrow}>{data.cooperativeName} · Konseptsjekkrunde</Text>
      <Text style={[s.h1, { marginTop: 6 }]}>{round.title}</Text>
      <Text style={[s.sub, { marginTop: 6 }]}>{dates ? `${dates} · ` : ""}{summary.completed} av {summary.expected} varehus vurdert · Laget {formatDate(today)}</Text>

      <View style={{ flexDirection: "row", marginTop: 20, marginRight: -8 }}>
        <Kpi label="Rundens snitt" value={formatScore(summary.roundAverage)} hint={summary.previousTitle ? `${signed(summary.averageChange)} fra ${shortRound(summary.previousTitle)}` : "Første runde"} hintColor={deltaColor(summary.averageChange)} />
        <Kpi label="Gjennomført" value={String(summary.completed)} unit={`av ${summary.expected}`} hint={`${summary.expected ? Math.round(summary.completed / summary.expected * 100) : 0} % dekning`} />
        <Kpi label="Høyest vurdert" value={summary.best[0] ? formatScore(summary.best[0].total) : "—"} hint={summary.best.map((entry) => entry.storeName.replace(/^Obs Bygg /, "")).join(" og ")} />
        <Kpi label="Svakeste område" value={summary.weakestArea ? formatScore(summary.weakestArea.average) : "—"} hint={summary.weakestArea?.label} />
      </View>

      <Text style={[s.h2, { marginTop: 26 }]}>Rangering</Text>
      <View style={{ flexDirection: "row", marginTop: 10, paddingBottom: 5, borderBottomWidth: 1.2, borderBottomColor: tokens.ink }}>
        <Text style={[s.label, { width: columns.rank }]}>Plass</Text>
        <Text style={[s.label, { width: columns.store }]}>Varehus</Text>
        <Text style={[s.label, { width: columns.total, textAlign: "right" }]}>Total</Text>
        {areas.map((area) => <Text key={area.key} style={[s.label, { width: columns.area, textAlign: "right" }]}>{area.label.replace("Varemottak", "Varemott.")}</Text>)}
        <Text style={[s.label, { width: columns.delta, textAlign: "right" }]}>Endring</Text>
      </View>
      {summary.ranking.map((entry) => <View key={entry.storeId} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 0.6, borderBottomColor: tokens.line }}>
        <Text style={{ width: columns.rank, fontFamily: "Display", fontWeight: 700, fontSize: 12, color: tokens.muted }}>{entry.rank}</Text>
        <Text style={{ width: columns.store, fontWeight: 600, fontSize: 10 }}>{entry.storeName}</Text>
        <Text style={{ width: columns.total, textAlign: "right", fontFamily: "Display", fontWeight: 700, fontSize: 14, color: band(entry.total) }}>{formatScore(entry.total)}</Text>
        {areas.map((area) => <Text key={area.key} style={{ width: columns.area, textAlign: "right", fontFamily: "Mono", fontSize: 8.5, color: band(entry.areas[area.key]) }}>{formatScore(entry.areas[area.key])}</Text>)}
        <Text style={{ width: columns.delta, textAlign: "right", fontFamily: "Mono", fontSize: 8.5, color: deltaColor(entry.delta) }}>{signed(entry.delta)}</Text>
      </View>)}
      <Text style={[s.small, { marginTop: 6 }]}>{summary.previousTitle ? `Endring er totalkarakter mot ${shortRound(summary.previousTitle)}. ` : ""}Grønt er over konsept, rødt under.</Text>
    </Page>

    <Page size="A4" style={s.page}>
      <Chrome label="Runderapport" storeName={data.cooperativeName} date={shortRound(round.title)} />
      <Text style={s.eyebrow}>Områdene på tvers</Text>
      <Text style={[s.h2, { marginTop: 4 }]}>{summary.weakestArea ? `${summary.weakestArea.label} er svakest i samvirkelaget` : "Områdene"}</Text>
      <View style={{ marginTop: 12 }}>
        {summary.areaAverages.map((area) => <View key={area.key} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 0.6, borderBottomColor: tokens.line }}>
          <Text style={{ width: 100, fontWeight: 600, fontSize: 10.5 }}>{area.label}</Text>
          <Bar score={area.average} width={170} />
          <Text style={{ width: 52, textAlign: "right", fontFamily: "Display", fontWeight: 700, fontSize: 15, color: band(area.average) }}>{formatScore(area.average)}</Text>
          <Text style={{ width: 52, textAlign: "right", fontFamily: "Mono", fontSize: 8.5, color: deltaColor(area.change) }}>{signed(area.change)}</Text>
          <Text style={[s.small, { flexGrow: 1, flexBasis: 0, marginLeft: 14, textAlign: "right" }]}>{area.weakest ? `Lavest: ${area.weakest.storeName.replace(/^Obs Bygg /, "")} ${formatScore(area.weakest.score)}` : ""}</Text>
        </View>)}
      </View>
      <Text style={[s.small, { marginTop: 6 }]}>Snitt av varehusenes karakter per område.{summary.previousTitle ? ` Endring mot ${shortRound(summary.previousTitle)}.` : ""}</Text>

      <Text style={[s.h2, { marginTop: 26 }]}>Utvikling</Text>
      <Text style={[s.small, { marginTop: 3, marginBottom: 10 }]}>Rundens snitt over tid. Stiplet linje er konsept (6).</Text>
      <HistoryChart history={summary.history} />
      <View style={{ marginTop: 14 }}>
        <View style={{ flexDirection: "row", paddingBottom: 5, borderBottomWidth: 1.2, borderBottomColor: tokens.ink }}>
          <Text style={[s.label, { width: 150 }]}>Varehus</Text>
          {summary.history.map((item) => <Text key={item.title} style={[s.label, { flexGrow: 1, flexBasis: 0, textAlign: "right" }]}>{shortRound(item.title)}</Text>)}
        </View>
        {summary.matrix.map((row) => <View key={row.storeName} style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.6, borderBottomColor: tokens.line }}>
          <Text style={{ width: 150, fontSize: 9.5, fontWeight: 600 }}>{row.storeName}</Text>
          {row.totals.map((total, index) => <Text key={index} style={{ flexGrow: 1, flexBasis: 0, textAlign: "right", fontFamily: index === row.totals.length - 1 ? "Display" : "Mono", fontWeight: index === row.totals.length - 1 ? 700 : 500, fontSize: index === row.totals.length - 1 ? 11 : 8.5, color: band(total) }}>{formatScore(total)}</Text>)}
        </View>)}
      </View>
    </Page>

    <Page size="A4" style={s.page}>
      <Chrome label="Runderapport" storeName={data.cooperativeName} date={shortRound(round.title)} />
      <Text style={s.eyebrow}>Varehusene</Text>
      <Text style={[s.h2, { marginTop: 4, marginBottom: 6 }]}>Resultat per varehus</Text>
      {summary.ranking.map((entry) => {
        const text = realSummary(entry.summary);
        return <View key={entry.storeId} wrap={false} style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1.2, borderTopColor: tokens.ink }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View><Text style={s.label}>Plass {entry.rank} · Besøk {formatDate(entry.date)}</Text><Text style={[s.h3, { fontSize: 16, marginTop: 4 }]}>{entry.storeName}</Text></View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontFamily: "Display", fontWeight: 700, fontSize: 30, lineHeight: 1, color: band(entry.total) }}>{formatScore(entry.total)}</Text>
              <Text style={[s.mono, { marginTop: 3, color: deltaColor(entry.delta) }]}>{entry.delta === null ? "Ingen forrige runde" : `${signed(entry.delta)} fra forrige runde`}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", marginTop: 10 }}>
            {areas.map((area, index) => <View key={area.key} style={{ flexGrow: 1, flexBasis: 0, marginLeft: index ? 10 : 0 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 8, color: tokens.muted }}>{area.label}</Text>
                <Text style={{ fontFamily: "Display", fontWeight: 700, fontSize: 10, color: band(entry.areas[area.key]) }}>{formatScore(entry.areas[area.key])}</Text>
              </View>
              <Bar score={entry.areas[area.key]} width={(contentWidth - 30) / 4} />
            </View>)}
          </View>
          {(entry.strengths.length > 0 || entry.improvements.length > 0) && <View style={{ flexDirection: "row", marginTop: 10 }}>
            {[{ title: "Styrker", items: entry.strengths, color: tokens.good }, { title: "Forbedringer", items: entry.improvements, color: tokens.bad }].filter((box) => box.items.length).map((box, index) =>
              <View key={box.title} style={{ flexGrow: 1, flexBasis: 0, marginLeft: index ? 10 : 0 }}>
                <Text style={[s.label, { color: box.color }]}>{box.title}</Text>
                {box.items.map((item) => <Text key={item} style={{ fontSize: 9, marginTop: 3 }}>• {item}</Text>)}
              </View>)}
          </View>}
          {text ? <Text style={[s.small, { marginTop: 8, color: tokens.ink }]}>{text.length > 420 ? `${text.slice(0, 419).trimEnd()}…` : text}</Text> : null}
        </View>;
      })}

      {data.openTasks.length > 0 && <View style={{ marginTop: 24 }}>
        <Text style={s.h2}>Åpne tiltak fra runden</Text>
        {data.openTasks.map((task) => <View key={task.id} wrap={false} style={{ flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.6, borderBottomColor: tokens.line }}>
          <Text style={{ width: 130, fontSize: 9, fontWeight: 600 }}>{task.storeName}</Text>
          <Text style={{ flexGrow: 1, flexBasis: 0, fontSize: 9 }}>{task.description}</Text>
          <Text style={[s.mono, { width: 90, textAlign: "right", color: task.due_date && task.due_date < today ? tokens.bad : tokens.muted }]}>{task.due_date ? `Frist ${formatDate(task.due_date)}` : "Ingen frist"}</Text>
        </View>)}
      </View>}
    </Page>
  </Document>;
}

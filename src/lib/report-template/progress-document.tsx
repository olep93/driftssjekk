import { Circle, Document, Line, Page, Polygon, Polyline, Rect, Svg, Text, View } from "@react-pdf/renderer";
import { formatDate, formatScore } from "../scoring";
import { reportKindLabel } from "../report-kind";
import type { StoreProgress } from "../store-progress";
import { contentWidth } from "./layout";
import { Chrome, s, statusLabel, tokens } from "./report-document";

export type ProgressDocumentData = {
  storeName: string; cooperativeName: string; periodLabel: string; generatedAt: string; today: string;
  progress: StoreProgress;
  highlights: { date: string; strengths: string[]; improvements: string[] } | null;
  history: { kind: string; eventId: string | null; date: string; total: number | null }[];
};

const signed = (value: number | null) => value === null ? "" : Math.abs(value) < 0.005 ? "±0,00" : `${value > 0 ? "+" : "−"}${formatScore(Math.abs(value))}`;
const deltaColor = (value: number | null) => value === null || Math.abs(value) < 0.005 ? tokens.muted : value > 0 ? tokens.good : tokens.bad;
const lowerBound = (values: (number | null)[]) => Math.min(4, Math.floor(Math.min(...values.filter((value): value is number => value !== null), 6) - 0.5));

export function Kpi({ label, value, unit, hint, hintColor, children }: { label: string; value: string; unit?: string; hint?: string; hintColor?: string; children?: React.ReactNode }) {
  return <View style={{ flexGrow: 1, flexBasis: 0, backgroundColor: tokens.soft, borderRadius: 6, padding: 11, marginRight: 8 }}>
    {/* Two label lines are reserved so the values line up across the boxes. */}
    <Text style={[s.label, { height: 18 }]}>{label}</Text>
    <Text style={{ fontFamily: "Display", fontWeight: 700, fontSize: 26, marginTop: 4, lineHeight: 1 }}>{value}{unit ? <Text style={{ fontFamily: "Plex", fontSize: 9, color: tokens.muted }}> {unit}</Text> : null}</Text>
    {hint ? <Text style={[s.mono, { marginTop: 6, color: hintColor || tokens.muted }]}>{hint}</Text> : null}
    {children}
  </View>;
}

/** Same chart as the dashboard: monthly reviews as a line, concept checks as diamonds, concept line at 6. */
function ProgressChartPdf({ series }: { series: StoreProgress["series"] }) {
  const width = contentWidth, height = 190, left = 22, right = 20, top = 14, bottom = 22;
  const min = lowerBound(series.flatMap((month) => [month.monthlyTotal, month.conceptTotal])), max = 10;
  const x = (index: number) => left + (series.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (series.length - 1));
  const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom);
  const points = series.map((month, index) => month.monthlyTotal === null ? null : { x: x(index), y: y(month.monthlyTotal), value: month.monthlyTotal }).filter((point): point is { x: number; y: number; value: number } => !!point);
  const ticks = Array.from({ length: max - min + 1 }, (_, index) => min + index).filter((tick) => tick % 2 === 0 || tick === 6);
  return <Svg width={width} height={height}>
    {ticks.map((tick) => <Line key={tick} x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={tick === 6 ? "#8f9aa8" : tokens.line} strokeWidth={tick === 6 ? 1 : 0.6} strokeDasharray={tick === 6 ? "4 3" : undefined} />)}
    {ticks.map((tick) => <Text key={`t${tick}`} x={left - 6} y={y(tick) + 2.5} style={{ fontFamily: tick === 6 ? "Display" : "Mono", fontSize: tick === 6 ? 8 : 6.5, fill: tick === 6 ? tokens.ink : tokens.faint }} textAnchor="end">{String(tick)}</Text>)}
    {points.length > 1 && <Polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={tokens.accent} strokeWidth={2} />}
    {points.map((point) => <Circle key={`c${point.x}`} cx={point.x} cy={point.y} r={3.2} fill={tokens.accent} stroke="#ffffff" strokeWidth={1} />)}
    {points.map((point) => <Text key={`v${point.x}`} x={point.x} y={point.y - 7} textAnchor="middle" style={{ fontFamily: "Mono", fontSize: 6.5, fill: tokens.ink }}>{formatScore(point.value)}</Text>)}
    {series.map((month, index) => month.conceptTotal === null ? null : <Polygon key={`d${month.month}`} points={`${x(index)},${y(month.conceptTotal) - 5} ${x(index) + 5},${y(month.conceptTotal)} ${x(index)},${y(month.conceptTotal) + 5} ${x(index) - 5},${y(month.conceptTotal)}`} fill={tokens.ink} />)}
    {series.map((month, index) => month.conceptTotal === null ? null : <Text key={`dv${month.month}`} x={x(index)} y={y(month.conceptTotal) + 14} textAnchor="middle" style={{ fontFamily: "Display", fontWeight: 700, fontSize: 8, fill: tokens.ink }}>{formatScore(month.conceptTotal)}</Text>)}
    {series.map((month, index) => <Text key={`m${month.month}`} x={x(index)} y={height - 6} textAnchor="middle" style={{ fontFamily: "Mono", fontSize: 6.3, fill: tokens.muted }}>{month.label}</Text>)}
  </Svg>;
}

function SparklinePdf({ values }: { values: (number | null)[] }) {
  const width = 96, height = 22, min = lowerBound(values), y = (value: number) => height - 2 - (value - min) / (10 - min) * (height - 4);
  const points = values.map((value, index) => value === null ? null : { x: values.length === 1 ? width / 2 : index * width / (values.length - 1), y: y(value) }).filter((point): point is { x: number; y: number } => !!point);
  return <Svg width={width} height={height}>
    <Line x1={0} x2={width} y1={y(6)} y2={y(6)} stroke="#8f9aa8" strokeWidth={0.6} strokeDasharray="3 2" />
    {points.length > 1 && <Polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={tokens.accent} strokeWidth={1.4} />}
    {points.map((point) => <Circle key={point.x} cx={point.x} cy={point.y} r={1.8} fill={tokens.accent} />)}
  </Svg>;
}

function TaskChartPdf({ series }: { series: StoreProgress["series"] }) {
  const width = contentWidth, height = 92, bottom = 14, max = Math.max(1, ...series.flatMap((month) => [month.created, month.done]));
  const slot = width / series.length, bar = Math.min(10, slot / 3), h = (value: number) => value / max * (height - bottom - 6);
  return <Svg width={width} height={height}>
    <Line x1={0} x2={width} y1={height - bottom} y2={height - bottom} stroke={tokens.line} strokeWidth={0.8} />
    {series.map((month, index) => {
      const center = index * slot + slot / 2;
      return [
        month.created > 0 ? <Rect key={`c${month.month}`} x={center - bar - 1} y={height - bottom - h(month.created)} width={bar} height={h(month.created)} fill="#c9d3dd" /> : null,
        month.done > 0 ? <Rect key={`d${month.month}`} x={center + 1} y={height - bottom - h(month.done)} width={bar} height={h(month.done)} fill={tokens.good} /> : null,
        <Text key={`l${month.month}`} x={center} y={height - 3} textAnchor="middle" style={{ fontFamily: "Mono", fontSize: 6, fill: tokens.muted }}>{month.label.split(" ")[0]}</Text>,
      ];
    })}
  </Svg>;
}

function Legend({ items }: { items: { label: string; color: string; shape?: "line" | "diamond" | "dash" | "box" }[] }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
    {items.map((item) => <View key={item.label} style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
      <View style={item.shape === "diamond" ? { width: 6, height: 6, backgroundColor: item.color, transform: "rotate(45deg)" } : item.shape === "dash" ? { width: 14, borderTopWidth: 1, borderTopColor: item.color, borderStyle: "dashed" } : item.shape === "box" ? { width: 7, height: 7, backgroundColor: item.color } : { width: 14, height: 2, backgroundColor: item.color }} />
      <Text style={[s.small, { marginLeft: 5 }]}>{item.label}</Text>
    </View>)}
  </View>;
}

/** Progress report for one store over a period, built from the same numbers as the store dashboard. */
export function ProgressDocument({ data }: { data: ProgressDocumentData }) {
  const { progress } = data, { tasks } = progress;
  const range = `${progress.series[0].label} – ${progress.series.at(-1)!.label}`;
  const inPeriod = data.history.filter((report) => report.date.slice(0, 7) >= progress.months[0]);
  return <Document title={`${data.storeName} – fremdrift`} author="Driftssjekk" language="nb-NO">
    <Page size="A4" style={s.page}>
      <Chrome label="Fremdriftsrapport" storeName={data.storeName} date={data.periodLabel.toLowerCase()} />
      <Text style={s.eyebrow}>{data.cooperativeName} · Fremdriftsrapport</Text>
      <Text style={[s.h1, { marginTop: 6 }]}>{data.storeName}</Text>
      <Text style={[s.sub, { marginTop: 6 }]}>{data.periodLabel} ({range}) · Laget {formatDate(data.today)}</Text>

      <View style={{ flexDirection: "row", marginTop: 20, marginRight: -8 }}>
        <Kpi label="Siste konseptsjekk" value={progress.latestConcept ? formatScore(progress.latestConcept.total) : "—"}
          hint={progress.latestConcept ? `${signed(progress.latestConcept.delta) || "Første"} · ${formatDate(progress.latestConcept.date)}` : "Ingen ennå"} hintColor={deltaColor(progress.latestConcept?.delta ?? null)} />
        <Kpi label="Siste driftsgjennomgang" value={progress.latestMonthly ? formatScore(progress.latestMonthly.total) : "—"}
          hint={progress.latestMonthly ? `${signed(progress.latestMonthly.delta) || "Første"} · ${formatDate(progress.latestMonthly.date)}` : "Ingen ennå"} hintColor={deltaColor(progress.latestMonthly?.delta ?? null)} />
        <Kpi label="Måneder med gjennomgang" value={String(progress.monthsCovered)} unit={`av ${progress.months.length}`}>
          <View style={{ flexDirection: "row", marginTop: 7 }}>{progress.series.map((month) => <View key={month.month} style={{ flexGrow: 1, height: 5, marginRight: 1.5, borderRadius: 1, backgroundColor: month.monthlyTotal !== null ? tokens.accent : "#dfe5ea" }} />)}</View>
        </Kpi>
        <Kpi label="Oppgaver i perioden" value={String(tasks.done)} unit={`av ${tasks.created} utført`}
          hint={`${tasks.open} åpne${tasks.averageDaysToDone !== null ? ` · ${Math.round(tasks.averageDaysToDone)} d snitt` : ""}`}>
          {tasks.overdue > 0 && <Text style={[s.mono, { color: tokens.bad, marginTop: 2 }]}>{tasks.overdue} forfalt</Text>}
        </Kpi>
      </View>

      <Text style={[s.h2, { marginTop: 24 }]}>Utvikling</Text>
      <Text style={[s.small, { marginTop: 3, marginBottom: 10 }]}>Månedlige driftsgjennomganger er intern progresjon og teller ikke i konseptrangeringen.</Text>
      <ProgressChartPdf series={progress.series} />
      <Legend items={[{ label: "Månedlig driftsgjennomgang", color: tokens.accent }, { label: "Uanmeldt konseptsjekk", color: tokens.ink, shape: "diamond" }, { label: "Konsept (6)", color: "#8f9aa8", shape: "dash" }]} />

      <View wrap={false} style={{ marginTop: 22 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Text style={s.h2}>Områdene</Text>
          <Text style={s.mono}>{progress.areaSource === "monthly" ? "Driftsgjennomganger" : "Konseptsjekker"}</Text>
        </View>
        <View style={{ marginTop: 8 }}>
          {progress.areaTrends.map((area) => <View key={area.key} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 0.6, borderBottomColor: tokens.line }}>
            <Text style={{ width: 120, fontWeight: 600, fontSize: 10.5 }}>{area.label}</Text>
            <View style={{ flexGrow: 1 }}><SparklinePdf values={progress.series.map((month) => (progress.areaSource === "monthly" ? month.areas : month.conceptAreas)[area.key])} /></View>
            <Text style={{ width: 60, textAlign: "right", fontFamily: "Display", fontWeight: 700, fontSize: 15 }}>{formatScore(area.latest)}</Text>
            <Text style={{ width: 64, textAlign: "right", fontFamily: "Mono", fontSize: 8.5, color: deltaColor(area.change) }}>{area.change === null ? "—" : signed(area.change)}</Text>
          </View>)}
        </View>
      </View>
    </Page>

    <Page size="A4" style={s.page}>
      <Chrome label="Fremdriftsrapport" storeName={data.storeName} date={data.periodLabel.toLowerCase()} />
      <Text style={s.eyebrow}>Oppgaver</Text>
      <Text style={[s.h2, { marginTop: 4 }]}>{tasks.done} av {tasks.created} oppgaver utført i perioden</Text>
      <View style={{ marginTop: 12 }}><TaskChartPdf series={progress.series} /></View>
      <Legend items={[{ label: "Gitt", color: "#c9d3dd", shape: "box" }, { label: "Utført", color: tokens.good, shape: "box" }]} />
      <Text style={[s.label, { marginTop: 18 }]}>Åpne oppgaver · {tasks.open}</Text>
      {!tasks.openList.length && <Text style={[s.small, { marginTop: 5 }]}>Ingen åpne oppgaver.</Text>}
      {tasks.openList.map((task) => {
        const overdue = !!task.dueDate && task.dueDate < data.today;
        const [background, color] = overdue ? [tokens.badSoft, tokens.bad] : task.status === "in_progress" ? [tokens.flagSoft, tokens.flag] : [tokens.midSoft, tokens.mid];
        return <View key={task.id} wrap={false} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 0.6, borderBottomColor: tokens.line }}>
          <View style={{ flexGrow: 1, flexBasis: 0 }}>
            <Text style={{ fontWeight: 600, fontSize: 10 }}>{task.description}</Text>
            <Text style={[s.small, { marginTop: 2 }]}>{task.dueDate ? `Frist ${formatDate(task.dueDate)}` : "Ingen frist"} · Gitt {formatDate(task.createdAt.slice(0, 10))}</Text>
          </View>
          <Text style={[s.pill, { marginLeft: 10, backgroundColor: background, color }]}>{overdue ? "Forfalt" : statusLabel[task.status] || task.status}</Text>
        </View>;
      })}

      {data.highlights && <View wrap={false} style={{ marginTop: 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Text style={s.h2}>Siste styrker og forbedringer</Text><Text style={s.mono}>{formatDate(data.highlights.date)}</Text>
        </View>
        <View style={{ flexDirection: "row", marginTop: 10 }}>
          {[{ title: "Styrker", items: data.highlights.strengths, color: tokens.good }, { title: "Forbedringer", items: data.highlights.improvements, color: tokens.bad }].filter((box) => box.items.length).map((box, index) =>
            <View key={box.title} style={{ flexGrow: 1, flexBasis: 0, marginLeft: index ? 12 : 0, backgroundColor: tokens.soft, borderRadius: 6, padding: 12 }}>
              <Text style={[s.label, { color: box.color }]}>{box.title}</Text>
              {box.items.map((item) => <View key={item} style={{ flexDirection: "row", marginTop: 5 }}><Text style={{ width: 9, color: box.color }}>•</Text><Text style={{ flexGrow: 1, flexBasis: 0 }}>{item}</Text></View>)}
            </View>)}
        </View>
      </View>}

      <View style={{ marginTop: 24 }}>
        <Text style={s.h2}>Rapporter i perioden</Text>
        <View style={{ marginTop: 8 }}>
          {!inPeriod.length && <Text style={s.small}>Ingen publiserte rapporter i perioden.</Text>}
          {inPeriod.map((report, index) => <View key={index} wrap={false} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 0.6, borderBottomColor: tokens.line }}>
            <Text style={[s.mono, { width: 90, color: tokens.ink }]}>{formatDate(report.date)}</Text>
            <Text style={{ flexGrow: 1, fontSize: 9.5 }}>{reportKindLabel(report.kind, report.eventId)}</Text>
            <Text style={{ width: 50, textAlign: "right", fontFamily: "Display", fontWeight: 700, fontSize: 12 }}>{formatScore(report.total)}</Text>
          </View>)}
        </View>
      </View>
    </Page>
  </Document>;
}

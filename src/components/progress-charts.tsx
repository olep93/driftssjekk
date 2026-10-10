import { formatScore } from "../lib/scoring";
import type { StoreProgress } from "../lib/store-progress";

/** Score over the period: monthly reviews as a line, concept checks as diamonds, the concept line at 6. */
export function ProgressChart({ series }: { series: StoreProgress["series"] }) {
  const width = 720, height = 230, left = 34, right = 14, top = 16, bottom = 30;
  const values = series.flatMap((month) => [month.monthlyTotal, month.conceptTotal]).filter((value): value is number => value !== null);
  // The scale starts below the lowest value (never above 4) so small changes stay visible.
  const min = Math.min(4, Math.floor(Math.min(...values, 6) - 0.5)), max = 10;
  const x = (index: number) => left + (series.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (series.length - 1));
  const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom);
  const monthlyPoints = series.map((month, index) => month.monthlyTotal === null ? null : { x: x(index), y: y(month.monthlyTotal), value: month.monthlyTotal }).filter((point): point is { x: number; y: number; value: number } => !!point);
  const ticks = Array.from({ length: max - min + 1 }, (_, index) => min + index).filter((tick) => tick % 2 === 0 || tick === 6);
  return <figure className="progress-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Utvikling i driftskarakter og konseptsjekker per måned">
      {ticks.map((tick) => <g key={tick}>
        <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className={tick === 6 ? "chart-concept" : "chart-grid"} />
        <text x={left - 8} y={y(tick) + 4} className={tick === 6 ? "chart-tick strong" : "chart-tick"} textAnchor="end">{tick}</text>
      </g>)}
      {monthlyPoints.length > 1 && <polyline points={monthlyPoints.map((point) => `${point.x},${point.y}`).join(" ")} className="chart-line" />}
      {monthlyPoints.map((point) => <g key={point.x}><circle cx={point.x} cy={point.y} r="4.5" className="chart-dot" /><text x={point.x} y={point.y - 10} textAnchor="middle" className="chart-value">{formatScore(point.value)}</text></g>)}
      {series.map((month, index) => month.conceptTotal === null ? null : <g key={month.month}>
        <rect x={x(index) - 6} y={y(month.conceptTotal) - 6} width="12" height="12" transform={`rotate(45 ${x(index)} ${y(month.conceptTotal)})`} className="chart-concept-mark" />
        <text x={x(index)} y={y(month.conceptTotal) + 22} textAnchor="middle" className="chart-value concept">{formatScore(month.conceptTotal)}</text>
      </g>)}
      {series.map((month, index) => <text key={month.month} x={x(index)} y={height - 8} textAnchor="middle" className="chart-tick">{month.label}</text>)}
    </svg>
    <figcaption className="chart-legend"><span><i className="legend-line" />Månedlig driftsgjennomgang</span><span><i className="legend-diamond" />Uanmeldt konseptsjekk</span><span><i className="legend-dash" />Konsept (6)</span></figcaption>
  </figure>;
}

/** Small trend line for one area, on the same lower bound as the main chart so changes stay visible. */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const width = 120, height = 30, scored = values.filter((value): value is number => value !== null);
  const min = Math.min(4, Math.floor(Math.min(...scored, 6) - 0.5)), y = (value: number) => height - 3 - (value - min) / (10 - min) * (height - 6);
  const points = values.map((value, index) => value === null ? null : `${values.length === 1 ? width / 2 : index * width / (values.length - 1)},${y(value)}`).filter(Boolean);
  if (!points.length) return <span className="muted small">Ingen data</span>;
  return <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
    <line x1="0" x2={width} y1={y(6)} y2={y(6)} className="chart-concept" />
    {points.length > 1 && <polyline points={points.join(" ")} className="chart-line thin" />}
    {points.map((point) => { const [cx, cy] = point!.split(","); return <circle key={point} cx={cx} cy={cy} r="2.5" className="chart-dot" />; })}
  </svg>;
}

/** Tasks created and completed per month, side by side. */
export function TaskChart({ series }: { series: StoreProgress["series"] }) {
  const width = 360, height = 150, bottom = 24, top = 10;
  const max = Math.max(1, ...series.flatMap((month) => [month.created, month.done]));
  const slot = width / series.length, bar = Math.min(14, slot / 3);
  const h = (value: number) => value / max * (height - top - bottom);
  return <figure className="progress-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Oppgaver opprettet og utført per måned">
      <line x1="0" x2={width} y1={height - bottom} y2={height - bottom} className="chart-grid" />
      {series.map((month, index) => {
        const center = index * slot + slot / 2;
        return <g key={month.month}>
          {month.created > 0 && <rect x={center - bar - 1} y={height - bottom - h(month.created)} width={bar} height={h(month.created)} className="bar-created" rx="2" />}
          {month.done > 0 && <rect x={center + 1} y={height - bottom - h(month.done)} width={bar} height={h(month.done)} className="bar-done" rx="2" />}
          <text x={center} y={height - 8} textAnchor="middle" className="chart-tick">{month.label.split(" ")[0]}</text>
        </g>;
      })}
    </svg>
    <figcaption className="chart-legend"><span><i className="legend-box created" />Gitt</span><span><i className="legend-box done" />Utført</span></figcaption>
  </figure>;
}

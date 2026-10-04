/*
 * Two small inline-SVG charts, no library: a sparkline for a KPI card and a
 * line chart with axis labels for the dashboard. Both are drawn left to right
 * (oldest first) in either language, so numbers and time read the same way.
 */

/** x of point `i` of `n`, in a 0..100 box; one point sits in the middle. */
const xOf = (i: number, n: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);

/** Zero sits here and the top value at TOP, so a line along zero is not cut in half by the edge. */
const BOTTOM = 94;
const TOP = 6;

/** y in a 0..100 box (0 = top) for a value between 0 and `max`; zero when max is 0. */
const yOf = (value: number, max: number) => (max <= 0 ? BOTTOM : BOTTOM - (value / max) * (BOTTOM - TOP));

const linePath = (values: readonly number[], max: number) =>
  values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i, values.length).toFixed(2)} ${yOf(v, max).toFixed(2)}`).join(' ');

/** A line without axes, for inside a card. Decorative: the card's own text carries the numbers. */
export function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length === 0) return null;
  const max = Math.max(...values);
  return (
    <svg className="spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path className="spark__line" d={linePath(values, max)} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface LineChartProps {
  values: readonly number[];
  /** The tooltip of each point, same length as `values`. */
  pointLabels: readonly string[];
  /** The axis numbers (the top, the middle and zero). */
  formatAxis: (value: number) => string;
  startLabel: string;
  endLabel: string;
  /** What a screen reader hears instead of the picture. */
  summary: string;
}

/** A line over a filled area with three horizontal guides; zero is always the bottom. */
export function LineChart({ values, pointLabels, formatAxis, startLabel, endLabel, summary }: LineChartProps) {
  const max = Math.max(0, ...values);
  const dense = values.length > 14;
  return (
    <figure className="chart" dir="ltr">
      <div className="chart__axis" aria-hidden="true">
        <span>{formatAxis(max)}</span>
        <span>{formatAxis(max / 2)}</span>
        <span>{formatAxis(0)}</span>
      </div>
      <div className="chart__plot" role="img" aria-label={summary}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[TOP, (TOP + BOTTOM) / 2, BOTTOM].map((y) => (
            <line key={y} className="chart__grid" x1="0" x2="100" y1={y} y2={y} vectorEffect="non-scaling-stroke" />
          ))}
          {values.length > 1 && (
            <path
              className="chart__area"
              d={`${linePath(values, max)} L100 ${BOTTOM} L0 ${BOTTOM} Z`}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path className="chart__line" d={linePath(values, max)} vectorEffect="non-scaling-stroke" />
        </svg>
        {values.map((v, i) => (
          <span
            key={i}
            className={dense && i !== values.length - 1 ? 'chart__dot chart__dot--dense' : 'chart__dot'}
            style={{ left: `${xOf(i, values.length)}%`, bottom: `${100 - yOf(v, max)}%` }}
            title={pointLabels[i]}
          />
        ))}
      </div>
      <div className="chart__x" aria-hidden="true">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </figure>
  );
}

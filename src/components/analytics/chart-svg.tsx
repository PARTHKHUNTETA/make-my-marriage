import { formatRupees } from "@/lib/money";
import type { ChartTheme } from "@/lib/palettes";
import { clip, compactValue, niceScale } from "@/modules/analytics/scale";
import type { ChartData } from "@/modules/analytics/schema";

// One chart drawn as a plain SVG: no chart library, so what is on screen is exactly what is
// exported to PNG. Colours are literal values (not CSS variables) for the same reason.
const W = 640;
const H = 340;
const M = { top: 34, right: 16, bottom: 74, left: 56 };
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

const fullValue = (v: number, unit: ChartData["unit"]) =>
  unit === "rupees" ? formatRupees(v) : String(v);

export function isEmpty(data: ChartData): boolean {
  return data.labels.length === 0 || data.series.every((s) => s.values.every((v) => v === 0));
}

export function ChartSvg({ data, theme }: { data: ChartData; theme: ChartTheme }) {
  const COLORS = theme.series;
  if (isEmpty(data)) return null;
  const n = data.labels.length;
  const stacked = data.kind === "stackedBar";
  const lined = data.kind === "line";
  const totals = data.labels.map((_, i) =>
    stacked
      ? data.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)
      : Math.max(...data.series.map((s) => s.values[i] ?? 0)),
  );
  const { top, ticks } = niceScale(Math.max(...totals));
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const y = (v: number) => M.top + plotH - (v / top) * plotH;
  const slot = plotW / n;
  const rotate = !lined && n > 4;
  // A long weekly line shows only some week names, so they stay readable.
  const every = lined ? Math.max(1, Math.ceil(n / 8)) : 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={data.title}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", fontFamily: FONT }}
      fontFamily={FONT}
    >
      <rect width={W} height={H} fill="#ffffff" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={theme.grid} />
          <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={theme.muted}>
            {compactValue(t, data.unit)}
          </text>
        </g>
      ))}

      {lined
        ? data.series.map((s, si) => {
            const x = (i: number) => M.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
            const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            return (
              <g key={s.name}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={COLORS[si % COLORS.length]}
                  strokeWidth="2.5"
                />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={COLORS[si % COLORS.length]}>
                    <title>{`${data.labels[i]}: ${fullValue(v, data.unit)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })
        : data.labels.map((label, i) => {
            const groupW = slot * 0.7;
            const barW = stacked || data.series.length === 1 ? groupW : groupW / data.series.length;
            const x0 = M.left + i * slot + (slot - groupW) / 2;
            let stackBase = 0;
            return (
              <g key={`${label}-${i}`}>
                {data.series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  const h = (v / top) * plotH;
                  const yTop = stacked ? y(stackBase + v) : y(v);
                  if (stacked) stackBase += v;
                  return (
                    <rect
                      key={s.name}
                      x={stacked || data.series.length === 1 ? x0 : x0 + si * barW}
                      y={yTop}
                      width={Math.max(1, barW - (stacked ? 0 : 2))}
                      height={Math.max(0, h)}
                      fill={COLORS[si % COLORS.length]}
                      rx="2"
                    >
                      <title>{`${label} · ${s.name}: ${fullValue(v, data.unit)}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}

      {data.labels.map((label, i) => {
        if (i % every !== 0) return null;
        const cx = lined
          ? M.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
          : M.left + i * slot + slot / 2;
        const ty = H - M.bottom + 16;
        return (
          <text
            key={`${label}-${i}`}
            x={cx}
            y={ty}
            fontSize="11"
            fill={theme.muted}
            textAnchor={rotate ? "end" : "middle"}
            transform={rotate ? `rotate(-35 ${cx} ${ty})` : undefined}
          >
            {clip(label, rotate ? 16 : 12)}
          </text>
        );
      })}

      {data.series.length > 1
        ? data.series.map((s, si) => (
            <g key={s.name} transform={`translate(${M.left + si * 120}, 10)`}>
              <rect width="11" height="11" rx="2" fill={COLORS[si % COLORS.length]} />
              <text x="16" y="10" fontSize="11" fill={theme.ink}>
                {s.name}
              </text>
            </g>
          ))
        : null}
    </svg>
  );
}

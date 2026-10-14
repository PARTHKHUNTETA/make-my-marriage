import type { MotifId } from "@/themes/kit";

// Decorative Indian motifs for the wedding website, drawn from simple geometry so they stay crisp
// at any size and take their colour from the surrounding text (currentColor). Purely decorative:
// every one is hidden from screen readers.

type Props = { className?: string; style?: React.CSSProperties };

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const round = (n: number) => Math.round(n * 100) / 100;

export function Mandala({ className, style }: Props) {
  return (
    <svg viewBox="-100 -100 200 200" aria-hidden className={className} style={style}>
      <g fill="none" stroke="currentColor" strokeWidth="1.1">
        <circle r="96" />
        <circle r="90" strokeDasharray="2 4" />
        {range(24).map((i) => (
          <ellipse key={`o${i}`} cy="-74" rx="7" ry="16" transform={`rotate(${i * 15})`} />
        ))}
        <circle r="56" />
        {range(16).map((i) => (
          <path
            key={`m${i}`}
            d="M0,-56 C10,-44 10,-34 0,-24 C-10,-34 -10,-44 0,-56Z"
            transform={`rotate(${i * 22.5})`}
          />
        ))}
        <circle r="20" />
        {range(8).map((i) => (
          <ellipse key={`i${i}`} cy="-12" rx="3.5" ry="8" transform={`rotate(${i * 45})`} />
        ))}
      </g>
      {range(24).map((i) => {
        const a = ((i * 15 + 7.5) * Math.PI) / 180;
        return (
          <circle
            key={`d${i}`}
            cx={round(Math.sin(a) * 62)}
            cy={round(-Math.cos(a) * 62)}
            r="1.6"
            fill="currentColor"
          />
        );
      })}
      <circle r="3" fill="currentColor" />
    </svg>
  );
}

function Flower({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${round(x)} ${round(y)})`}>
      {range(10).map((i) => (
        <ellipse
          key={i}
          cy={-r * 0.55}
          rx={r * 0.32}
          ry={r * 0.55}
          fill="currentColor"
          opacity={i % 2 ? 0.75 : 1}
          transform={`rotate(${i * 36})`}
        />
      ))}
      <circle r={r * 0.32} fill="currentColor" opacity="0.55" />
    </g>
  );
}

// Swags of marigold strung across the top of a section.
export function Garland({ className, style, swags = 3 }: Props & { swags?: number }) {
  const width = 120 * swags;
  return (
    <svg
      viewBox={`0 0 ${width} 56`}
      aria-hidden
      className={className}
      style={style}
      preserveAspectRatio="xMidYMin meet"
    >
      {range(swags).map((s) =>
        range(9).map((i) => {
          const t = i / 8;
          const x = s * 120 + t * 120;
          const y = 6 + Math.sin(t * Math.PI) * 32;
          return <Flower key={`${s}-${i}`} x={x} y={y} r={i === 0 || i === 8 ? 6 : 7} />;
        }),
      )}
      {range(swags + 1).map((s) => (
        <g key={`h${s}`}>
          {range(3).map((i) => (
            <Flower key={i} x={s * 120} y={14 + i * 12} r={5.5} />
          ))}
        </g>
      ))}
    </svg>
  );
}

// A toran: a cord of mango leaves with small bells, hung across the top of the hero.
export function Toran({ className, style }: Props) {
  const leaves = 15;
  return (
    <svg
      viewBox="0 0 400 64"
      aria-hidden
      className={className}
      style={style}
      preserveAspectRatio="xMidYMin meet"
    >
      <path d="M0,6 Q200,16 400,6" fill="none" stroke="currentColor" strokeWidth="2" />
      {range(leaves).map((i) => {
        const x = 14 + i * ((400 - 28) / (leaves - 1));
        const sag = 6 + Math.sin((x / 400) * Math.PI) * 5;
        if (i % 2 === 1) {
          return (
            <g key={i} transform={`translate(${round(x)} ${round(sag)})`}>
              <line y2="22" stroke="currentColor" strokeWidth="1" />
              <path d="M-6,30 Q-6,20 0,20 Q6,20 6,30 Z" fill="currentColor" />
              <circle cy="32" r="1.8" fill="currentColor" />
            </g>
          );
        }
        return (
          <g key={i} transform={`translate(${round(x)} ${round(sag)})`}>
            <path
              d="M0,0 C11,12 10,34 0,48 C-10,34 -11,12 0,0Z"
              fill="currentColor"
              opacity="0.85"
            />
            <path d="M0,4 L0,44" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          </g>
        );
      })}
    </svg>
  );
}

export function Lotus({ className, style }: Props) {
  return (
    <svg viewBox="-60 -50 120 70" aria-hidden className={className} style={style}>
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M0,10 C-12,-6 -10,-30 0,-46 C10,-30 12,-6 0,10Z" />
        <path d="M0,10 C-22,4 -30,-18 -24,-36 C-10,-28 -4,-10 0,10Z" />
        <path d="M0,10 C22,4 30,-18 24,-36 C10,-28 4,-10 0,10Z" />
        <path d="M0,10 C-30,12 -50,-2 -54,-16 C-36,-18 -14,-6 0,10Z" />
        <path d="M0,10 C30,12 50,-2 54,-16 C36,-18 14,-6 0,10Z" />
        <path d="M-40,16 Q0,6 40,16" />
      </g>
    </svg>
  );
}

// The small ornament between sections, matched to the site's motif.
export function MotifDivider({ motif, color }: { motif: MotifId; color: string }) {
  const line = <span className="h-px w-14 sm:w-24" style={{ backgroundColor: color }} />;
  const mark =
    motif === "mandala" ? (
      <Mandala className="size-10" />
    ) : motif === "lotus" ? (
      <Lotus className="h-8 w-12" />
    ) : motif === "marigold" ? (
      <svg viewBox="-10 -10 20 20" aria-hidden className="size-8">
        <Flower x={0} y={0} r={9} />
      </svg>
    ) : motif === "toran" ? (
      <svg viewBox="-8 0 16 30" aria-hidden className="h-7 w-4">
        <path d="M0,0 C8,8 7,22 0,30 C-7,22 -8,8 0,0Z" fill="currentColor" />
      </svg>
    ) : (
      <span className="size-1.5 rotate-45" style={{ backgroundColor: color }} />
    );
  return (
    <div aria-hidden className="mt-4 flex items-center justify-center gap-3" style={{ color }}>
      {line}
      {mark}
      {line}
    </div>
  );
}

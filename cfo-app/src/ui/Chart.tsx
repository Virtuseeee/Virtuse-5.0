import { useMemo, useRef, useState } from 'react'
import * as F from '../core/format'
import type { Lang } from '../core/format'

export interface Series {
  label: string
  color: string
  values: number[]
  dashed?: boolean
}

/** Small hand-drawn line chart: two or three series over the same x labels. */
export function LineChart({ x, series, lang, height = 220 }: { x: string[]; series: Series[]; lang: Lang; height?: number }) {
  const W = 760
  const H = height
  const pad = { l: 84, r: 12, t: 12, b: 26 }
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const { min, max } = useMemo(() => {
    const all = series.flatMap((s) => s.values)
    const lo = Math.min(0, ...all)
    const hi = Math.max(...all, 1)
    return { min: lo, max: hi * 1.05 }
  }, [series])
  if (x.length < 2) return null
  const xs = (i: number) => pad.l + (i / (x.length - 1)) * (W - pad.l - pad.r)
  const ys = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  const ticks = [0, 0.5, 1].map((f) => min + f * (max - min))
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join('')
  const area = (vals: number[]) => `${path(vals)}L${xs(vals.length - 1)},${ys(min)}L${xs(0)},${ys(min)}Z`
  const short = (n: number) => F.eurShort(n, lang)

  function move(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (x.length - 1))
    setHover(Math.max(0, Math.min(x.length - 1, i)))
  }

  return (
    <div className="chart">
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}><i style={{ background: s.color }} />{s.label}{hover !== null && <b>{F.eur(s.values[hover], lang)}</b>}</span>
        ))}
        {hover !== null && <em>{x[hover]}</em>}
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.label).join(', ')} onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={series[0].color} stopOpacity="0.22" />
            <stop offset="1" stopColor={series[0].color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(v)} y2={ys(v)} className="grid" />
            <text x={pad.l - 8} y={ys(v) + 4} textAnchor="end" className="axis">{short(v)}</text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} className="axis">{x[0]}</text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" className="axis">{x[x.length - 1]}</text>
        <path d={area(series[0].values)} fill="url(#chartFill)" />
        {series.map((s) => (
          <path key={s.label} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.5 : 2} strokeDasharray={s.dashed ? '5 5' : undefined} strokeLinejoin="round" />
        ))}
        {hover !== null && (
          <g>
            <line x1={xs(hover)} x2={xs(hover)} y1={pad.t} y2={H - pad.b} className="cross" />
            {series.map((s) => <circle key={s.label} cx={xs(hover)} cy={ys(s.values[hover])} r="4" fill={s.color} />)}
          </g>
        )}
      </svg>
    </div>
  )
}

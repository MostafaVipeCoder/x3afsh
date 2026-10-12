// Small dependency-free chart pieces for the owner dashboard (RTL-aware, theme tokens only).
import type { ReactNode } from 'react'

const nf = new Intl.NumberFormat('en-US')
export const fmt = (v: number | string | null | undefined, suffix = '') => v == null || v === '' ? '—' : `${nf.format(Number(v))}${suffix}`

export function Stat({ label, value, prev, suffix, hint, warn, count }: {
  label: string; value: unknown; prev?: unknown; suffix?: string; hint?: string; warn?: boolean; count?: unknown
}) {
  const isNum = (v: unknown) => v != null && v !== '' && !isNaN(Number(v))
  const cur = isNum(value) ? Number(value) : null
  const old = isNum(prev) ? Number(prev) : null
  const display = value == null ? null : typeof value === 'string' && !isNum(value) ? value : cur
  const cnt = isNum(count) ? Number(count) : null
  let change: ReactNode = null
  if (cur != null && old != null && old !== 0) {
    const pct = Math.round(((cur - old) / Math.abs(old)) * 100)
    change = <span className={`chg ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}`}>{pct > 0 ? '▲' : pct < 0 ? '▼' : '='} {Math.abs(pct)}%</span>
  } else if (cur != null && old === 0 && cur > 0) {
    change = <span className="chg up">جديد</span>
  }
  return (
    <div className={`stat ${warn ? 'warn' : ''}`} title={hint}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{typeof display === 'string' ? display : fmt(display, suffix)} {change}</div>
      {cnt != null && <div className="meta" style={{ fontSize: 11 }}>من {cnt} إجابة{cnt < 30 ? ' ⚠️ عينة صغيرة' : ''}</div>}
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

export function Bars({ data, labelKey = 'name', valueKey = 'count', max }: { data: Record<string, unknown>[]; labelKey?: string; valueKey?: string; max?: number }) {
  if (!data || data.length === 0) return <p className="meta">مفيش بيانات في الفترة دي</p>
  const m = max ?? Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1)
  return (
    <div className="hbars">
      {data.map((d, i) => (
        <div key={i} className="hbar">
          <span className="hbar-label">{String(d[labelKey])}</span>
          <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(Number(d[valueKey]) / m) * 100}%` }} /></span>
          <span className="hbar-val">{fmt(Number(d[valueKey]))}</span>
        </div>
      ))}
    </div>
  )
}

export function Line({ data, keys, colors, labels }: { data: Record<string, unknown>[]; keys: string[]; colors?: string[]; labels?: string[] }) {
  if (!data || data.length === 0) return <p className="meta">مفيش بيانات</p>
  const W = 600, H = 160, P = 24
  const max = Math.max(1, ...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)))
  const x = (i: number) => P + (i / Math.max(1, data.length - 1)) * (W - 2 * P)
  const y = (v: number) => H - P - (v / max) * (H - 2 * P)
  const cols = colors ?? ['var(--primary)', 'var(--accent)']
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', direction: 'ltr' }} role="img" aria-label="رسم بياني">
        {[0, 0.5, 1].map((t) => <line key={t} x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} stroke="var(--line)" strokeDasharray="3 3" />)}
        {keys.map((k, ki) => (
          <g key={k}>
            <polyline fill="none" stroke={cols[ki]} strokeWidth={2.5} strokeLinejoin="round" points={data.map((d, i) => `${x(i)},${y(Number(d[k]) || 0)}`).join(' ')} />
            {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(Number(d[k]) || 0)} r={3} fill={cols[ki]}><title>{String(d.d)}: {String(d[k])}</title></circle>)}
          </g>
        ))}
        <text x={P} y={H - 6} fontSize={10} fill="var(--muted)">{String(data[0].d).slice(5)}</text>
        <text x={W - P} y={H - 6} fontSize={10} fill="var(--muted)" textAnchor="end">{String(data[data.length - 1].d).slice(5)}</text>
        <text x={P - 4} y={y(max) + 4} fontSize={10} fill="var(--muted)" textAnchor="end">{max}</text>
      </svg>
      {labels && (
        <div className="legend">{keys.map((k, i) => <span key={k}><i style={{ background: cols[i] }} />{labels[i]}</span>)}</div>
      )}
    </div>
  )
}

export function Funnel({ steps }: { steps: { label: string; value: number | null }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value ?? 0))
  return (
    <div className="hbars">
      {steps.map((s, i) => (
        <div key={i} className="hbar">
          <span className="hbar-label">{s.label}</span>
          <span className="hbar-track"><span className="hbar-fill" style={{ width: `${((s.value ?? 0) / max) * 100}%`, background: i === 0 ? 'var(--primary-soft)' : i === 1 ? 'var(--primary)' : 'var(--accent)' }} /></span>
          <span className="hbar-val">{fmt(s.value, ' ج')}</span>
        </div>
      ))}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/* Owner dashboard: how full the database and photo storage are, with a danger signal before they fill up. */

interface Meter { used: number; limit: number; pct: number; per_day: number | null; days_left: number | null }
interface Capacity {
  plan: string
  warn_pct: number
  danger_pct: number
  db: Meter
  storage: Meter & { files: number; avg_listing_bytes: number | null; listings_left: number }
  users: { active_30d: number; limit: number; pct: number }
  egress_limit: number
}

type Level = 'ok' | 'warn' | 'danger'

export function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '—'
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} جيجا`
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} ميجا`
  if (b >= 1024) return `${Math.round(b / 1024)} كيلو`
  return `${b} بايت`
}

const nf = new Intl.NumberFormat('en-US')

function level(pct: number, warn: number, danger: number): Level {
  return pct >= danger ? 'danger' : pct >= warn ? 'warn' : 'ok'
}

const LEVEL_TEXT: Record<Level, string> = { ok: 'آمن', warn: 'قرّبت', danger: 'خطر' }

function daysText(days: number | null): string | null {
  if (days == null) return null
  if (days > 3650) return 'مش هتتملي قريب بالمعدل الحالي'
  if (days > 60) return `بالمعدل الحالي هتتملي بعد حوالي ${Math.round(days / 30)} شهر`
  return `بالمعدل الحالي هتتملي بعد حوالي ${days} يوم`
}

function Bar({ title, used, limit, pct, lvl, lines }: { title: string; used: string; limit: string; pct: number; lvl: Level; lines: (string | null)[] }) {
  return (
    <div className={`cap card card-body cap-${lvl}`}>
      <div className="cap-head">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className={`cap-badge cap-${lvl}`}>{LEVEL_TEXT[lvl]}</span>
      </div>
      <div className="cap-num"><b>{pct}%</b> <span className="meta">— {used} من {limit}</span></div>
      <div className="cap-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={title}>
        <div className="cap-fill" style={{ width: `${Math.min(100, Math.max(pct, 0.5))}%` }} />
      </div>
      {lines.filter(Boolean).map((l, i) => <div key={i} className="meta" style={{ fontSize: 13, marginTop: 4 }}>{l}</div>)}
    </div>
  )
}

export default function CapacityPanel() {
  const [cap, setCap] = useState<Capacity | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('owner_capacity').then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setCap(data as Capacity)
    })
  }, [])

  if (error) return <div className="alert alert-error">مقدرناش نقرا مساحة التخزين: {error}</div>
  if (!cap) return null

  const dbL = level(cap.db.pct, cap.warn_pct, cap.danger_pct)
  const stL = level(cap.storage.pct, cap.warn_pct, cap.danger_pct)
  const usL = level(cap.users.pct, cap.warn_pct, cap.danger_pct)
  const worst: Level = [dbL, stL, usL].includes('danger') ? 'danger' : [dbL, stL, usL].includes('warn') ? 'warn' : 'ok'

  return (
    <section className="dash-section" style={{ marginTop: 14 }}>
      {worst !== 'ok' && (
        <div className={`alert ${worst === 'danger' ? 'alert-error' : 'alert-warn'}`} role="alert">
          {worst === 'danger' ? '🔴 ' : '🟡 '}
          {worst === 'danger'
            ? 'المساحة قرّبت تخلص. لو خلصت، رفع الصور أو حفظ البيانات هيقف. رقّي باقة Supabase دلوقتي.'
            : 'المساحة عدّت ' + cap.warn_pct + '%. ابدأ تخطط للترقية خلال الأسابيع الجاية.'}
          {' '}<a href="https://supabase.com/dashboard/project/idxjtijqhpencivsoigw/settings/billing/subscription" target="_blank" rel="noreferrer">صفحة الباقة في Supabase</a>
        </div>
      )}
      <h2>⓪ صحة المنصة — المساحة <span className="meta" style={{ fontSize: 14, fontWeight: 600 }}>باقة Supabase: {cap.plan}</span></h2>
      <div className="charts2">
        <Bar
          title="الصور"
          used={fmtBytes(cap.storage.used)} limit={fmtBytes(cap.storage.limit)} pct={cap.storage.pct} lvl={stL}
          lines={[
            `${nf.format(cap.storage.files)} صورة · فاضل مكان لحوالي ${nf.format(cap.storage.listings_left)} طقم`,
            cap.storage.avg_listing_bytes ? `متوسط صور الطقم الواحد ${fmtBytes(cap.storage.avg_listing_bytes)}` : 'التقدير مفترض 1.75 ميجا للطقم، وهيبقى دقيق بعد أول 10 أطقم',
            daysText(cap.storage.days_left),
          ]}
        />
        <Bar
          title="قاعدة البيانات"
          used={fmtBytes(cap.db.used)} limit={fmtBytes(cap.db.limit)} pct={cap.db.pct} lvl={dbL}
          lines={[
            'الحسابات والأطقم والرسايل والتقييمات والاستبيانات',
            cap.db.days_left != null ? daysText(cap.db.days_left) : 'معدل النمو هيظهر بعد 3 أيام من التسجيل اليومي',
          ]}
        />
        <Bar
          title="مستخدمين نشطين (آخر 30 يوم)"
          used={nf.format(cap.users.active_30d)} limit={nf.format(cap.users.limit)} pct={cap.users.pct} lvl={usL}
          lines={['اللي دخلوا المنصة في آخر 30 يوم مقابل حد الباقة']}
        />
      </div>
      <p className="meta" style={{ marginTop: 8, fontSize: 13 }}>
        الأصفر عند {cap.warn_pct}% والأحمر عند {cap.danger_pct}%. فيه حد تالت مش ظاهر هنا: <b>التحميل الشهري (Egress) {fmtBytes(cap.egress_limit)}</b>، وده بيزيد كل ما الناس بتفتح صور أكتر. بتتابعه من{' '}
        <a href="https://supabase.com/dashboard/project/idxjtijqhpencivsoigw/settings/usage" target="_blank" rel="noreferrer">صفحة الاستخدام في Supabase</a>.
      </p>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Stat, Line, Bars } from './charts'
import { STATUS_LABEL, type ListingStatus } from '../lib/types'
import { formatPrice } from '../lib/format'

/* Owner dashboard: visits, visitors, page views and time on page — overall, per page, and per listing. */

interface Totals { sessions: number; visitors: number; logged_in_visitors: number; views: number; avg_session_seconds: number | null; pages_per_session: number | null; single_page_pct: number | null }
interface PageRow { page: string; views: number; visitors: number; avg_seconds: number | null }
interface ListingRow { id: string; title: string; status: ListingStatus; price: number | null; views: number; visitors: number; avg_seconds: number | null; contacts: number }
interface Traffic { totals: Totals; by_page: PageRow[]; by_listing: ListingRow[]; daily: Record<string, unknown>[]; devices: { name: string; count: number }[] }

const PAGE_LABEL: Record<string, string> = {
  home: 'الرئيسية (التصفح والبحث)',
  listing: 'صفحة طقم',
  new: 'اعرض طقم',
  edit: 'تعديل طقم',
  my: 'أطقمي',
  inbox: 'الوارد',
  chat: 'محادثة',
  negotiation: 'تفاوض',
  favorites: 'المفضلة',
  account: 'حسابي',
  login: 'الدخول',
  terms: 'شروط الاستخدام',
  privacy: 'سياسة الخصوصية',
}
const DEVICE_LABEL: Record<string, string> = { mobile: 'موبايل', desktop: 'كمبيوتر' }

const nf = new Intl.NumberFormat('en-US')

export function duration(sec: number | null | undefined): string {
  if (sec == null) return '—'
  if (sec < 60) return `${sec} ث`
  const m = Math.floor(sec / 60), s = sec % 60
  return s ? `${m} د ${s} ث` : `${m} د`
}

export default function TrafficPanel({ from, to, pfrom, pto }: { from: Date; to: Date; pfrom: Date; pto: Date }) {
  const [cur, setCur] = useState<Traffic | null>(null)
  const [prev, setPrev] = useState<Traffic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setCur(null)
    Promise.all([
      supabase.rpc('owner_traffic', { p_from: from.toISOString(), p_to: to.toISOString() }),
      supabase.rpc('owner_traffic', { p_from: pfrom.toISOString(), p_to: pto.toISOString() }),
    ]).then(([a, b]) => {
      if (a.error) { setError(a.error.message); return }
      setCur(a.data as Traffic); setPrev(b.data as Traffic)
    })
  }, [from, to, pfrom, pto])

  if (error) return <div className="alert alert-error">مقدرناش نقرا الزيارات: {error}</div>
  if (!cur) return null

  const t = cur.totals, p = prev?.totals
  const listings = showAll ? cur.by_listing : cur.by_listing.slice(0, 15)

  return (
    <section className="dash-section">
      <h2>📈 الزيارات والمشاهدات</h2>
      <p className="meta">زياراتك أنت ومشاهدة البايع لطقمه مش بيتحسبوا. المدة = الوقت اللي الصفحة كانت ظاهرة فيه قدام الشخص فعلًا.</p>

      <div className="stats">
        <Stat label="الزيارات" value={t.sessions} prev={p?.sessions} hint="مرة فتح المنصة. لو سابها نص ساعة ورجع تتحسب زيارة جديدة." />
        <Stat label="الزوار" value={t.visitors} prev={p?.visitors} hint={`أجهزة مختلفة. منهم ${nf.format(t.logged_in_visitors)} مسجّلين دخول.`} />
        <Stat label="مشاهدات الصفحات" value={t.views} prev={p?.views} hint="كل مرة صفحة اتفتحت" />
        <Stat label="متوسط مدة الزيارة" value={duration(t.avg_session_seconds)} hint="مجموع الوقت في كل الصفحات خلال الزيارة الواحدة" />
        <Stat label="صفحات في الزيارة" value={t.pages_per_session} prev={p?.pages_per_session} hint="متوسط عدد الصفحات اللي الشخص بيفتحها في الزيارة" />
        <Stat label="زيارات صفحة واحدة بس" value={t.single_page_pct} suffix="%" warn={(t.single_page_pct ?? 0) > 60} hint="دخل وخرج من غير ما يفتح حاجة تانية. لو أعلى من 60% يبقى أول صفحة مش جاذبة." />
      </div>

      <div className="charts2">
        <div className="card card-body"><h3>الزيارات يوم بيوم</h3><Line data={cur.daily} keys={['sessions', 'visitors']} labels={['زيارات', 'زوار']} /></div>
        <div className="card card-body"><h3>الزوار حسب الجهاز</h3><Bars data={cur.devices.map((d) => ({ name: DEVICE_LABEL[d.name] ?? d.name, count: d.count }))} /></div>
      </div>

      <div className="card card-body" style={{ marginTop: 12 }}>
        <h3>كل صفحة اتفتحت كام مرة</h3>
        {cur.by_page.length === 0 ? <p className="meta">مفيش زيارات في الفترة دي</p> : (
          <div className="table-wrap">
            <table className="dtable">
              <thead><tr><th>الصفحة</th><th>مشاهدات</th><th>زوار</th><th>متوسط المدة</th></tr></thead>
              <tbody>
                {cur.by_page.map((r) => (
                  <tr key={r.page}><td>{PAGE_LABEL[r.page] ?? r.page}</td><td>{nf.format(r.views)}</td><td>{nf.format(r.visitors)}</td><td>{duration(r.avg_seconds)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-body" style={{ marginTop: 12 }}>
        <h3>كل طقم اتشاف كام مرة</h3>
        <p className="meta" style={{ marginTop: 0 }}>مرتبين من الأكتر مشاهدة. "تواصل" = ضغطات اتصال أو واتساب في نفس الفترة. اضغط على الطقم عشان تراجعه.</p>
        {cur.by_listing.length === 0 ? <p className="meta">محدش فتح طقم في الفترة دي</p> : (
          <>
            <div className="table-wrap">
              <table className="dtable">
                <thead><tr><th>الطقم</th><th>الحالة</th><th>مشاهدات</th><th>زوار</th><th>متوسط المدة</th><th>تواصل</th><th>نسبة التواصل</th></tr></thead>
                <tbody>
                  {listings.map((r) => (
                    <tr key={r.id}>
                      <td><Link to={`/listing/${r.id}`}>{r.title}</Link><div className="meta" style={{ fontSize: 12 }}>{formatPrice(r.price)}</div></td>
                      <td><span className={`pill pill-${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
                      <td>{nf.format(r.views)}</td>
                      <td>{nf.format(r.visitors)}</td>
                      <td>{duration(r.avg_seconds)}</td>
                      <td>{nf.format(r.contacts)}</td>
                      <td>{r.visitors > 0 ? `${Math.round((100 * r.contacts) / r.visitors)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cur.by_listing.length > 15 && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'اعرض أول 15 بس' : `اعرض الكل (${cur.by_listing.length})`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Stat, Bars, Line, Funnel, fmt } from '../components/charts'
import { NOT_BOUGHT_REASONS, USEFUL_REASONS, IMPROVEMENT_OPTIONS, CSAT_TRIGGER_LABEL, label } from '../lib/surveyOptions'
import { pageView } from '../lib/analytics'

type Dash = Record<string, Record<string, unknown>>
type Series = Record<string, unknown>

const PRESETS: [string, number][] = [['آخر 7 أيام', 7], ['آخر 30 يوم', 30], ['آخر 90 يوم', 90]]

function pct(a: unknown, b: unknown): number | null {
  const x = Number(a), y = Number(b)
  return y > 0 ? Math.round((x / y) * 1000) / 10 : null
}

export default function Dashboard() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [days, setDays] = useState(30)
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [cur, setCur] = useState<Dash | null>(null)
  const [prev, setPrev] = useState<Dash | null>(null)
  const [ts, setTs] = useState<Series | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)

  const range = useMemo(() => {
    if (custom) {
      const from = new Date(custom.from), to = new Date(custom.to); to.setDate(to.getDate() + 1)
      const len = to.getTime() - from.getTime()
      return { from, to, pfrom: new Date(from.getTime() - len), pto: from }
    }
    const to = new Date(); to.setHours(23, 59, 59, 999)
    const from = new Date(to); from.setDate(from.getDate() - days + 1); from.setHours(0, 0, 0, 0)
    const pfrom = new Date(from); pfrom.setDate(pfrom.getDate() - days)
    return { from, to, pfrom, pto: from }
  }, [days, custom])

  useEffect(() => {
    if (loading) return
    if (!session) { navigate('/login?next=/dashboard'); return }
    if (profile && !profile.is_owner) { navigate('/'); return }
  }, [session, profile, loading, navigate])

  useEffect(() => {
    if (!profile?.is_owner) return
    pageView('dashboard', { days })
    setBusy(true); setError(null)
    Promise.all([
      supabase.rpc('owner_dashboard', { p_from: range.from.toISOString(), p_to: range.to.toISOString() }),
      supabase.rpc('owner_dashboard', { p_from: range.pfrom.toISOString(), p_to: range.pto.toISOString() }),
      supabase.rpc('owner_timeseries', { p_from: range.from.toISOString(), p_to: range.to.toISOString() }),
    ]).then(([a, b, c]) => {
      if (a.error) { setError(a.error.message); setBusy(false); return }
      setCur(a.data as Dash); setPrev(b.data as Dash); setTs(c.data as Series); setBusy(false)
    })
  }, [profile?.is_owner, range]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !profile?.is_owner) return <div className="spinner" />

  function exportCsv() {
    if (!cur) return
    const rows: string[][] = [['القسم', 'المؤشر', 'الفترة الحالية', 'الفترة السابقة']]
    for (const [section, vals] of Object.entries(cur)) {
      if (!vals || typeof vals !== 'object') continue
      for (const [k, v] of Object.entries(vals)) {
        if (Array.isArray(v) || (v && typeof v === 'object')) continue
        rows.push([section, k, String(v ?? ''), String((prev?.[section] as Record<string, unknown> | undefined)?.[k] ?? '')])
      }
    }
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `x3afsh-dashboard-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const c = cur ?? {}, p = prev ?? {}
  const g = (s: string, k: string, src: Dash = c) => (src[s] as Record<string, unknown> | undefined)?.[k]
  const arr = (s: string, k: string) => (g(s, k) as Record<string, unknown>[] | undefined) ?? []
  const pc = c.post_contact ?? {}, pp = p.post_contact ?? {}

  return (
    <div className="container dash">
      <div className="dash-head">
        <div>
          <h1 style={{ margin: 0 }}>لوحة التحكم</h1>
          <div className="meta">{range.from.toLocaleDateString('ar-EG-u-nu-latn')} → {range.to.toLocaleDateString('ar-EG-u-nu-latn')} · المقارنة مع الفترة اللي قبلها بنفس الطول</div>
        </div>
        <div className="row" style={{ flex: '0 0 auto', alignItems: 'center' }}>
          {PRESETS.map(([l, d]) => <button key={d} className={`btn btn-sm ${!custom && days === d ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setCustom(null); setDays(d) }}>{l}</button>)}
          <input type="date" className="input" style={{ width: 'auto', padding: '6px 8px' }} onChange={(e) => e.target.value && setCustom({ from: e.target.value, to: custom?.to ?? new Date().toISOString().slice(0, 10) })} aria-label="من" />
          <input type="date" className="input" style={{ width: 'auto', padding: '6px 8px' }} onChange={(e) => e.target.value && setCustom({ from: custom?.from ?? e.target.value, to: e.target.value })} aria-label="إلى" />
          <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!cur}>⬇ تصدير CSV</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {busy && <div className="spinner" />}

      {cur && !busy && (
        <>
          {/* ① الحسابات */}
          <section className="dash-section">
            <h2>① الحسابات</h2>
            <div className="stats">
              <Stat label="إجمالي الحسابات" value={g('accounts', 'total')} hint="كل الحسابات من يوم الإطلاق" />
              <Stat label="حسابات جديدة" value={g('accounts', 'new')} prev={g('accounts', 'new', p) as number} />
              <Stat label="الحسابات النشطة" value={g('accounts', 'active')} prev={g('accounts', 'active', p) as number} hint="عملت فعل حقيقي في الفترة (نشر / تعليق / رسالة / تفاوض / اتصال). التصفح لوحده مش نشاط." />
              <Stat label="نسبة النشاط" value={pct(g('accounts', 'active'), g('accounts', 'total'))} suffix="%" warn={(pct(g('accounts', 'active'), g('accounts', 'total')) ?? 100) < 20} hint="النشطة ÷ الإجمالي. أقل من 20% إنذار." />
            </div>
            <div className="charts2">
              <div className="card card-body"><h3>حسابات جديدة يوم بيوم</h3><Line data={(ts?.accounts_daily as Record<string, unknown>[]) ?? []} keys={['n']} /></div>
              <div className="card card-body"><h3>الحسابات النشطة أسبوع بأسبوع</h3><Line data={(ts?.active_weekly as Record<string, unknown>[]) ?? []} keys={['n']} colors={['var(--accent)']} /></div>
            </div>
          </section>

          {/* ② الأطقم */}
          <section className="dash-section">
            <h2>② الأطقم</h2>
            <div className="stats">
              <Stat label="إجمالي الأطقم المعروضة" value={g('listings', 'total_published')} hint="كل اللي وصل لحالة معروض من يوم الإطلاق" />
              <Stat label="أطقم جديدة" value={g('listings', 'new')} prev={g('listings', 'new', p) as number} />
              <Stat label="المعروض حاليًا" value={g('listings', 'live_now')} hint="رقم لحظي، مش بيتأثر بالفترة" />
              <Stat label="اتباعت" value={g('listings', 'sold')} prev={g('listings', 'sold', p) as number} hint="حسب كلام البايع" />
              <Stat label="متوسط مدة العرض (يوم)" value={g('listings', 'avg_days_to_sell')} prev={g('listings', 'avg_days_to_sell', p) as number} hint="من النشر لحد اتباع" />
            </div>
            <div className="charts2">
              <div className="card card-body"><h3>أطقم جديدة يوم بيوم</h3><Line data={(ts?.listings_daily as Record<string, unknown>[]) ?? []} keys={['n']} /></div>
              <div className="card card-body"><h3>المعروض حسب التصنيف</h3><Bars data={arr('listings', 'by_category')} /></div>
              <div className="card card-body"><h3>المعروض حسب المحافظة</h3><Bars data={arr('listings', 'by_governorate')} /></div>
            </div>
          </section>

          {/* ③ التواصل */}
          <section className="dash-section">
            <h2>③ التواصل</h2>
            <div className="stats">
              <Stat label="المحادثات المفتوحة" value={g('contact', 'conversations')} prev={g('contact', 'conversations', p) as number} hint="اتبعت فيها رسالة واحدة على الأقل" />
              <Stat label="نسبة الرد" value={pct(g('contact', 'replied'), g('contact', 'conversations'))} suffix="%" warn={(pct(g('contact', 'replied'), g('contact', 'conversations')) ?? 100) < 50} hint="البايع رد ÷ المحادثات. أقل من 50% مشكلة." />
              <Stat label="رد خلال 24 ساعة" value={pct(g('contact', 'replied_24h'), g('contact', 'conversations'))} suffix="%" hint="الهدف أعلى من 60%" />
              <Stat label="ضغطات اتصال / واتساب" value={g('contact', 'clicks')} prev={g('contact', 'clicks', p) as number} hint={`واتساب ${fmt(g('contact', 'clicks_whatsapp') as number)} · اتصال ${fmt(g('contact', 'clicks_call') as number)}. أقرب مؤشر للبيع الفعلي.`} />
              <Stat label="متوسط التعليقات لكل طقم" value={g('contact', 'avg_comments_per_listing')} />
            </div>
          </section>

          {/* ④ التفاوض */}
          <section className="dash-section">
            <h2>④ التفاوض</h2>
            <div className="stats">
              <Stat label="عدد التفاوضات" value={g('negotiation', 'started')} prev={g('negotiation', 'started', p) as number} />
              <Stat label="انتهت باتفاق" value={g('negotiation', 'agreed')} prev={g('negotiation', 'agreed', p) as number} />
              <Stat label="نسبة النجاح" value={pct(g('negotiation', 'agreed'), g('negotiation', 'started'))} suffix="%" />
              <Stat label="متوسط سعر البداية (الكل)" value={g('negotiation', 'avg_opening_all')} suffix=" ج" />
              <Stat label="متوسط سعر البداية (الناجح بس)" value={g('negotiation', 'avg_opening_agreed')} suffix=" ج" hint="نفس مجموعة التفاوضات اللي اتحسب عليها سعر النهاية" />
              <Stat label="متوسط سعر النهاية" value={g('negotiation', 'avg_final')} suffix=" ج" />
              <Stat label="متوسط الفرق" value={g('negotiation', 'avg_diff')} suffix=" ج" hint="محسوب داخل كل تفاوض ناجح على حدة، مش طرح المتوسطين" />
              <Stat label="متوسط الفرق كنسبة" value={g('negotiation', 'avg_diff_pct')} suffix="%" />
              <Stat label="متوسط الخصم عن السعر المعروض" value={g('negotiation', 'avg_discount_pct')} suffix="%" />
              <Stat label="متوسط عدد الردود" value={g('negotiation', 'avg_rounds')} />
            </div>
            <div className="charts2">
              <div className="card card-body"><h3>التفاوض شهر بشهر</h3><Line data={(ts?.negotiation_monthly as Record<string, unknown>[]) ?? []} keys={['started', 'agreed']} labels={['بدأت', 'اتفاق']} /></div>
            </div>
          </section>

          {/* ⑤ الرضا */}
          <section className="dash-section">
            <h2>⑤ رضا المستخدمين</h2>
            <div className="stats">
              <Stat label="درجة الرضا (CSAT)" value={g('satisfaction', 'csat_pct')} suffix="%" prev={g('satisfaction', 'csat_pct', p) as number} count={g('satisfaction', 'responses') as number} hint="نسبة اللي قيّموا 4 أو 5" />
              <Stat label="متوسط الرضا" value={g('satisfaction', 'avg_score')} suffix=" / 5" />
              <Stat label="نسبة التخطّي" value={pct(g('satisfaction', 'skipped'), Number(g('satisfaction', 'skipped')) + Number(g('satisfaction', 'responses')))} suffix="%" hint="لو عالية يبقى السؤال بيظهر في وقت غلط" />
            </div>
            <div className="charts2">
              <div className="card card-body"><h3>الرضا حسب نوع الفعل</h3>
                <Bars data={arr('satisfaction', 'by_trigger').map((t) => ({ name: `${CSAT_TRIGGER_LABEL[String(t.trigger)] ?? t.trigger} (${t.n})`, count: t.avg }))} max={5} />
              </div>
              <div className="card card-body"><h3>آخر التعليقات</h3>
                {arr('satisfaction', 'comments').length === 0 ? <p className="meta">مفيش تعليقات نصية لسه</p> : arr('satisfaction', 'comments').map((x, i) => <div key={i} className="quote"><b>{String(x.score)}/5</b> — {String(x.comment)}</div>)}
              </div>
            </div>
          </section>

          {/* ⑥ ما بعد التواصل */}
          <section className="dash-section">
            <h2>⑥ ما بعد التواصل — البيع الفعلي</h2>
            <p className="meta">كل الأرقام هنا بكلام المستخدمين (استبيان بعد الضغط على اتصال/واتساب). مش مؤكدة من المنصة.</p>
            <h3>أ. هل البيع بيتم؟</h3>
            <div className="stats">
              <Stat label="ضغطات تواصل اتسألت" value={pc.shown as number} prev={pp.shown as number} />
              <Stat label="نسبة الإجابة" value={pct(pc.answered, pc.shown)} suffix="%" warn={(pct(pc.answered, pc.shown) ?? 100) < 30} hint="أقل من 30%: نراجع توقيت السؤال" />
              <Stat label="نسبة إتمام البيع" value={pct(pc.bought, Number(pc.bought) + Number(pc.not_bought))} suffix="%" count={Number(pc.bought) + Number(pc.not_bought)} hint="اشتريت ÷ (اشتريت + متمتش). أقرب رقم لـ'المنصة بتبيع ولا لأ'." />
              <Stat label="بيعات مُبلّغ عنها" value={pc.bought as number} prev={pp.bought as number} />
              <Stat label="تقدير إجمالي البيع" value={pc.sum_paid as number} suffix=" ج" />
              <Stat label="لسه بيتكلموا / مجهول" value={`${fmt(pc.still_talking as number)} / ${fmt(pc.unknown as number)}`} />
            </div>
            <h3>ب. الأسعار — الكلام مقابل الواقع</h3>
            <div className="stats">
              <Stat label="متوسط سعر البيع الفعلي" value={pc.avg_paid as number} suffix=" ج" count={pc.bought as number} />
              <Stat label="الفرق عن السعر المعروض" value={pc.avg_diff_listed_pct as number} suffix="%" hint="الناس بتنزل كام % عن سعر الإعلان في الواقع" />
              <Stat label="الفرق عن سعر التفاوض" value={pc.avg_diff_vs_negotiation as number} suffix=" ج" hint="سعر الاتفاق − اللي اتدفع فعلًا. رقم كبير = الاتفاق مش بيتحترم" />
              <Stat label="نسبة التكاليف الإضافية" value={pc.extra_costs_pct as number} suffix="%" />
              <Stat label="متوسط التكاليف الإضافية" value={pc.avg_extra_costs as number} suffix=" ج" />
              <Stat label="متوسط التكلفة الكاملة" value={pc.avg_total_cost as number} suffix=" ج" hint="سعر + نقل/تركيب + تحسين" />
            </div>
            <div className="charts2">
              <div className="card card-body"><h3>السعر المعروض ← التفاوض ← الفعلي</h3>
                <Funnel steps={[{ label: 'معروض', value: (ts?.price_funnel as Record<string, number | null>)?.listed ?? null }, { label: 'اتفاق التفاوض', value: (ts?.price_funnel as Record<string, number | null>)?.negotiated ?? null }, { label: 'اتدفع فعلًا', value: (ts?.price_funnel as Record<string, number | null>)?.paid ?? null }]} />
              </div>
              <div className="card card-body"><h3>نسبة إتمام البيع شهر بشهر</h3><Line data={(ts?.completion_monthly as Record<string, unknown>[]) ?? []} keys={['bought', 'not_bought']} labels={['اشتروا', 'ماشتروش']} /></div>
            </div>
            <h3>ج. الثقة وجودة الإعلانات</h3>
            <div className="stats">
              <Stat label="مبالغ غير متفق عليها" value={pc.unagreed_pct as number} suffix="%" warn={(Number(pc.unagreed_pct) || 0) > 5} hint="🔴 إنذار. الهدف أقل من 5%" />
              <Stat label="رضا عن حالة المنتج" value={pc.condition_avg as number} suffix=" / 5" />
              <Stat label="الحالة مقابل الصور" value={`${fmt(pc.condition_better as number)} أحسن · ${fmt(pc.condition_same as number)} زي · ${fmt(pc.condition_worse as number)} أسوأ`} warn={pct(pc.condition_worse, Number(pc.condition_better) + Number(pc.condition_same) + Number(pc.condition_worse)) != null && (pct(pc.condition_worse, Number(pc.condition_better) + Number(pc.condition_same) + Number(pc.condition_worse)) ?? 0) > 15} hint="لو 'أسوأ' أكتر من 15% يبقى شرط الصور مش كفاية" />
              <Stat label="صرفوا على التحسين" value={pc.improvement_pct as number} suffix="%" />
              <Stat label="متوسط تكلفة التحسين" value={pc.avg_improvement as number} suffix=" ج" />
            </div>
            <div className="charts2">
              <div className="card card-body"><h3>بايعين يحتاجون مراجعة</h3>
                {((c.trust_flags as unknown as Record<string, unknown>[]) ?? []).length === 0 && <p className="meta">مفيش حد وصل لـ3 بلاغات من مشترين مختلفين. كويس.</p>}
                {((c.trust_flags as unknown as Record<string, unknown>[]) ?? []).map((f, i) => (
                  <div key={i} className="quote"><b>{String(f.name)}</b> <bdi>{String(f.phone ?? '')}</bdi> — {String(f.reporters)} مشترين · مبالغ غير متفقة {String(f.unagreed)} · أسوأ من الصور {String(f.worse)} · مش محترم {String(f.rude)}</div>
                ))}
              </div>
              <div className="card card-body"><h3>أطقم اتخفت بعد بلاغات</h3>
                {((c.flagged_listings as unknown as Record<string, unknown>[]) ?? []).length === 0 ? <p className="meta">مفيش</p> : ((c.flagged_listings as unknown as Record<string, unknown>[]) ?? []).map((l, i) => (
                  <div key={i} className="quote"><Link to={`/listing/${l.id}`}>{String(l.title)}</Link> — {String(l.reports)} بلاغات · البايع {String(l.seller)}</div>
                ))}
              </div>
            </div>
            <h3>د. ليه البيع مبيتمش؟</h3>
            <div className="charts2">
              <div className="card card-body"><h3>أسباب عدم الإتمام</h3>
                <Bars data={arr('post_contact', 'reasons').map((r) => ({ name: label(NOT_BOUGHT_REASONS, String(r.reason)), count: r.count }))} />
              </div>
              <div className="card card-body">
                <div className="stats" style={{ gridTemplateColumns: '1fr' }}>
                  <Stat label="نسبة 'البايع مردش'" value={pct(arr('post_contact', 'reasons').find((r) => r.reason === 'no_reply')?.count ?? 0, pc.not_bought)} suffix="%" hint="لو عالية: تذكير البايعين أو إظهار سرعة الرد" />
                  <Stat label="لسه بيدوروا" value={pc.still_searching_pct as number} suffix="%" hint="ناس لسه ليها قيمة عندك" />
                </div>
              </div>
            </div>
            <h3>هـ. فايدة المنصة</h3>
            <div className="stats">
              <Stat label="'مفيدة' — اللي اشتروا" value={pc.useful_pct_bought as number} suffix="%" />
              <Stat label="'مفيدة' — اللي ماشتروش" value={pc.useful_pct_not_bought as number} suffix="%" hint="الرقم المهم: قيمة المنصة في حد ذاتها" />
              <Stat label="بايعين: متوسط سعر البيع" value={g('seller_survey', 'avg_sold_price')} suffix=" ج" count={g('seller_survey', 'n') as number} />
              <Stat label="بايعين: المشتري كان محترم" value={g('seller_survey', 'respectful_pct')} suffix="%" />
              <Stat label="بايعين: المنصة ساعدتني" value={g('seller_survey', 'helped_pct')} suffix="%" />
              <Stat label="تطابق سعر البايع والمشتري" value={g('seller_survey', 'price_match_pct')} suffix="%" hint="نفس الطقم، الفرق أقل من 5%" />
            </div>
            <div className="charts2">
              <div className="card card-body"><h3>إيه اللي كان مفيد</h3><Bars data={arr('post_contact', 'useful_reasons').map((r) => ({ name: label(USEFUL_REASONS, String(r.reason)), count: r.count }))} /></div>
              <div className="card card-body"><h3>إيه اللي ينقص</h3><Bars data={arr('post_contact', 'improvement_options').map((r) => ({ name: label(IMPROVEMENT_OPTIONS, String(r.reason)), count: r.count }))} /></div>
              <div className="card card-body"><h3>اقتراحات التحسين (آخر 20)</h3>
                {arr('post_contact', 'suggestions').length === 0 ? <p className="meta">مفيش اقتراحات نصية لسه</p> : arr('post_contact', 'suggestions').map((s, i) => <div key={i} className="quote">{String(s.text)}</div>)}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

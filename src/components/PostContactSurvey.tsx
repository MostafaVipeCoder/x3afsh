import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, imageUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/analytics'
import { formatPrice } from '../lib/format'
import { NOT_BOUGHT_REASONS, USEFUL_REASONS, IMPROVEMENT_OPTIONS, EXTRA_COST_TYPES } from '../lib/surveyOptions'
import Stars from './Stars'

interface Survey { id: string; listing_id: string; shown_count: number; first_contact_at: string }
interface ListingLite { title: string; price: number | null; image: string | null }

type Answers = Record<string, unknown>
type StepId = 'outcome' | 'paid' | 'extra' | 'unagreed' | 'condition' | 'improvement' | 'useful' | 'useful_why' | 'improve_how' | 'reasons' | 'searching' | 'done'

const BOUGHT_STEPS: StepId[] = ['outcome', 'paid', 'extra', 'unagreed', 'condition', 'improvement', 'useful']
const NOT_BOUGHT_STEPS: StepId[] = ['outcome', 'reasons', 'searching', 'useful']

/** Rules H1–H14: ask the buyer what happened after they clicked call / WhatsApp. Mounted once in App. */
export default function PostContactSurvey() {
  const { session } = useAuth()
  const location = useLocation()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [listing, setListing] = useState<ListingLite | null>(null)
  const [step, setStep] = useState<StepId>('outcome')
  const [a, setA] = useState<Answers>({})
  const [busy, setBusy] = useState(false)
  const started = useRef(0)
  const checked = useRef<{ user: string; at: number }>({ user: '', at: 0 })

  // Check at most once a minute per user, on navigation, whether a survey is due (H2, H5, H6 are enforced in the database)
  useEffect(() => {
    if (!session || survey) return
    const uid = session.user.id
    if (checked.current.user === uid && Date.now() - checked.current.at < 60_000) return
    checked.current = { user: uid, at: Date.now() }
    supabase.rpc('due_post_contact_survey').then(async ({ data }) => {
      const s = (data as Survey | null)
      if (!s || !s.id) return
      const { data: l } = await supabase.from('listings').select('title, price, listing_images(storage_path, position)').eq('id', s.listing_id).maybeSingle()
      const imgs = ((l as { listing_images?: { storage_path: string; position: number }[] } | null)?.listing_images ?? []).sort((x, y) => x.position - y.position)
      setListing({ title: (l as { title?: string } | null)?.title ?? '', price: (l as { price?: number } | null)?.price ?? null, image: imgs[0]?.storage_path ?? null })
      setSurvey(s); setStep('outcome'); setA({}); started.current = Date.now()
      await supabase.rpc('mark_survey_shown', { p_survey: s.id })
      track('post_contact_survey_shown', { survey_id: s.id, listing_id: s.listing_id, ask_number: s.shown_count + 1, days_since_contact: Math.round((Date.now() - new Date(s.first_contact_at).getTime()) / 86400000) })
    })
  }, [session, location.pathname, survey])

  if (!survey || !listing) return null

  const steps = a.outcome === 'bought' ? BOUGHT_STEPS : NOT_BOUGHT_STEPS
  const idx = steps.indexOf(step)
  const total = steps.length + 1

  async function save(patch: Answers, status: 'answered' | 'skipped', lastStep: number) {
    setBusy(true)
    await supabase.from('post_contact_surveys').update({ ...patch, status, last_step_reached: lastStep, answered_at: new Date().toISOString(), duration_seconds: Math.round((Date.now() - started.current) / 1000) }).eq('id', survey!.id)
    setBusy(false)
  }

  async function snooze() {
    setBusy(true)
    await supabase.rpc('snooze_post_contact_survey', { p_survey: survey!.id })
    setBusy(false)
    track('post_contact_survey_answered_first', { survey_id: survey!.id, outcome: 'still_talking' })
    setSurvey(null)
  }

  async function close() {
    // H7: whatever was answered is kept
    const answeredOutcome = a.outcome === 'bought' || a.outcome === 'not_bought'
    await save(a, answeredOutcome ? 'answered' : 'skipped', idx)
    track('post_contact_survey_exited', { survey_id: survey!.id, at_step: step, step_index: idx })
    setSurvey(null)
  }

  function go(patch: Answers, next: StepId) {
    const merged = { ...a, ...patch }
    setA(merged)
    track('post_contact_survey_step', { survey_id: survey!.id, step, step_index: idx })
    setStep(next)
  }

  async function finish(patch: Answers) {
    const merged = { ...a, ...patch }
    setA(merged)
    await save(merged, 'answered', steps.length)
    track('post_contact_survey_completed', { survey_id: survey!.id, outcome: merged.outcome, seconds: Math.round((Date.now() - started.current) / 1000) })
    setStep('done')
  }

  const nextAfterUseful = (useful: boolean): StepId => useful ? 'useful_why' : 'improve_how'

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        {step !== 'done' && <button className="modal-close" aria-label="إغلاق" onClick={close} disabled={busy}>×</button>}
        {step !== 'outcome' && step !== 'done' && (
          <div className="steps" style={{ marginBottom: 10 }}>{Array.from({ length: total }).map((_, i) => <div key={i} className={i < idx ? 'done' : i === idx ? 'cur' : ''} />)}</div>
        )}
        {step !== 'outcome' && step !== 'done' && <p className="meta" style={{ margin: '0 0 6px' }}>{idx + 1} من {total}</p>}

        {step === 'outcome' && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              {listing.image && <img src={imageUrl(listing.image)} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />}
              <div><b>{listing.title}</b><div className="meta">{formatPrice(listing.price)}</div></div>
            </div>
            <h2>تواصلت مع البايع على الطقم ده — البيعة تمت؟</h2>
            <div className="choice-list">
              <button className="btn btn-primary" onClick={() => { track('post_contact_survey_answered_first', { survey_id: survey.id, outcome: 'bought' }); go({ outcome: 'bought' }, 'paid') }}>أيوه اشتريته ✓</button>
              <button className="btn btn-outline" onClick={() => { track('post_contact_survey_answered_first', { survey_id: survey.id, outcome: 'not_bought' }); go({ outcome: 'not_bought' }, 'reasons') }}>لأ، متمتش</button>
              <button className="btn btn-ghost" onClick={snooze} disabled={busy}>لسه بنتكلم</button>
            </div>
          </>
        )}

        {step === 'paid' && <NumberStep title="اشتريته بكام؟" hint={`السعر المعروض كان ${formatPrice(listing.price)}`} onNext={(v) => go({ paid_price: v }, 'extra')} onSkip={() => go({}, 'extra')} />}

        {step === 'extra' && (
          <YesNoStep title="دفعت تكاليف إضافية (نقل / فك وتركيب)؟"
            onNo={() => go({ extra_costs: false }, 'unagreed')}
            yesForm={(done) => <AmountWithTypes types={EXTRA_COST_TYPES} amountLabel="كام تقريبًا؟" onDone={(amount, types) => { go({ extra_costs: true, extra_costs_amount: amount, extra_costs_types: types }, 'unagreed'); done() }} />}
          />
        )}

        {step === 'unagreed' && (
          <YesNoStep title="كان فيه مبالغ مكانتش متفق عليها قبل الاستلام؟"
            onNo={() => go({ unagreed_amounts: false }, 'condition')}
            yesForm={(done) => <AmountWithNote onDone={(amount, note) => { go({ unagreed_amounts: true, unagreed_amount: amount, unagreed_note: note }, 'condition'); done() }} />}
          />
        )}

        {step === 'condition' && <ConditionStep onNext={(rating, vs) => go({ condition_rating: rating, condition_vs_photos: vs }, 'improvement')} />}

        {step === 'improvement' && (
          <YesNoStep title="اضطريت تصرف عليه عشان تحسّنه (تنجيد / دهان / إصلاح)؟"
            onNo={() => go({ improvement_spent: false }, 'useful')}
            yesForm={(done) => <AmountWithTypes types={[]} amountLabel="كام تقريبًا؟" onDone={(amount) => { go({ improvement_spent: true, improvement_amount: amount }, 'useful'); done() }} />}
          />
        )}

        {step === 'reasons' && (
          <MultiStep title="ليه البيعة متمتش؟" hint="اختار كل اللي ينطبق" options={NOT_BOUGHT_REASONS} otherKey="other"
            onNext={(sel, other) => go({ not_bought_reasons: sel, not_bought_other: other || null }, 'searching')} />
        )}

        {step === 'searching' && (
          <>
            <h2>لسه بتدور على عفش شبهه؟</h2>
            <div className="choice-list">
              <button className="btn btn-primary" onClick={() => go({ still_searching: true }, 'useful')}>أيوه</button>
              <button className="btn btn-outline" onClick={() => go({ still_searching: false }, 'useful')}>لأ</button>
            </div>
          </>
        )}

        {step === 'useful' && (
          <>
            <h2>المنصة كانت مفيدة ليك؟</h2>
            <div className="choice-list">
              <button className="btn btn-primary" onClick={() => go({ platform_useful: true }, nextAfterUseful(true))}>أيوه</button>
              <button className="btn btn-outline" onClick={() => go({ platform_useful: false }, nextAfterUseful(false))}>لأ</button>
            </div>
          </>
        )}

        {step === 'useful_why' && (
          <MultiStep title="إيه اللي كان مفيد؟" options={USEFUL_REASONS} otherKey="other" onNext={(sel) => finish({ useful_reasons: sel })} />
        )}

        {step === 'improve_how' && (
          <MultiStep title="إزاي تنصحنا نحسّن؟" options={IMPROVEMENT_OPTIONS} otherKey="other" freeTextLabel="قولنا بكلامك (اختياري)" alwaysFreeText
            onNext={(sel, text) => finish({ improvement_options: sel, improvement_suggestion: text || null })} />
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 40 }}>🙏</div>
            <h2>شكرًا، إجاباتك بتساعدنا نحسّن المنصة</h2>
            <button className="btn btn-primary" onClick={() => setSurvey(null)}>تمام</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- small step widgets ---------- */

function NumberStep({ title, hint, onNext, onSkip }: { title: string; hint?: string; onNext: (v: number) => void; onSkip: () => void }) {
  const [v, setV] = useState('')
  return (
    <>
      <h2>{title}</h2>
      {hint && <p className="meta">{hint}</p>}
      <input className="input" type="number" inputMode="numeric" min={1} value={v} onChange={(e) => setV(e.target.value)} placeholder="بالجنيه" autoFocus />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary" disabled={!(Number(v) > 0)} onClick={() => onNext(Number(v))}>التالي</button>
        <button className="btn btn-ghost" onClick={onSkip}>مش فاكر</button>
      </div>
    </>
  )
}

function YesNoStep({ title, onNo, yesForm }: { title: string; onNo: () => void; yesForm: (done: () => void) => JSX.Element }) {
  const [yes, setYes] = useState(false)
  return (
    <>
      <h2>{title}</h2>
      {!yes ? (
        <div className="choice-list">
          <button className="btn btn-outline" onClick={() => setYes(true)}>أيوه</button>
          <button className="btn btn-primary" onClick={onNo}>لأ</button>
        </div>
      ) : yesForm(() => setYes(false))}
    </>
  )
}

function AmountWithTypes({ types, amountLabel, onDone }: { types: [string, string][]; amountLabel: string; onDone: (amount: number | null, types: string[]) => void }) {
  const [amount, setAmount] = useState('')
  const [sel, setSel] = useState<string[]>([])
  return (
    <div>
      {types.length > 0 && (
        <div className="chips">
          {types.map(([s, l]) => <button key={s} type="button" className={sel.includes(s) ? 'on' : ''} onClick={() => setSel((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}>{l}</button>)}
        </div>
      )}
      <label className="meta">{amountLabel}</label>
      <input className="input" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="بالجنيه" />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary" onClick={() => onDone(amount ? Number(amount) : null, sel)}>التالي</button>
      </div>
    </div>
  )
}

function AmountWithNote({ onDone }: { onDone: (amount: number | null, note: string) => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  return (
    <div>
      <label className="meta">كام تقريبًا؟</label>
      <input className="input" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="بالجنيه" />
      <label className="meta" style={{ display: 'block', marginTop: 8 }}>إيه هي؟ (اختياري)</label>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلًا: طلب فلوس زيادة على النقل" />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary" onClick={() => onDone(amount ? Number(amount) : null, note.trim())}>التالي</button>
      </div>
    </div>
  )
}

function ConditionStep({ onNext }: { onNext: (rating: number, vs: string | null) => void }) {
  const [rating, setRating] = useState<number | null>(null)
  const [vs, setVs] = useState<string | null>(null)
  return (
    <>
      <h2>حالة المنتج لما استلمته عجبتك؟</h2>
      <Stars value={rating} onChange={setRating} size={32} />
      <p className="meta" style={{ marginTop: 10 }}>مقارنة بالصور كان:</p>
      <div className="chips">
        {[['better', 'أحسن من الصور'], ['same', 'زي الصور'], ['worse', 'أسوأ من الصور']].map(([s, l]) => (
          <button key={s} type="button" className={vs === s ? 'on' : ''} onClick={() => setVs(s)}>{l}</button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary" disabled={rating == null} onClick={() => onNext(rating!, vs)}>التالي</button>
      </div>
    </>
  )
}

function MultiStep({ title, hint, options, otherKey, freeTextLabel, alwaysFreeText, onNext }: {
  title: string; hint?: string; options: [string, string][]; otherKey?: string; freeTextLabel?: string; alwaysFreeText?: boolean
  onNext: (selected: string[], freeText: string) => void
}) {
  const [sel, setSel] = useState<string[]>([])
  const [text, setText] = useState('')
  const showText = alwaysFreeText || (otherKey && sel.includes(otherKey))
  return (
    <>
      <h2>{title}</h2>
      {hint && <p className="meta">{hint}</p>}
      <div className="chips">
        {options.map(([s, l]) => <button key={s} type="button" className={sel.includes(s) ? 'on' : ''} onClick={() => setSel((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}>{l}</button>)}
      </div>
      {showText && <textarea className="input" style={{ minHeight: 70, marginTop: 8 }} placeholder={freeTextLabel || 'اكتب…'} value={text} onChange={(e) => setText(e.target.value)} />}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary" disabled={sel.length === 0 && !text.trim()} onClick={() => onNext(sel, text.trim())}>التالي</button>
      </div>
    </>
  )
}

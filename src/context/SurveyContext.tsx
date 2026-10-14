import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { track } from '../lib/analytics'

/**
 * Rule G1 (revised 2026-10-14): the satisfaction question is NOT asked right after an action.
 * It is asked on a later visit, once the user has had a real experience with another person
 * (or a week passed with no contact). The database decides eligibility (csat_due), including
 * the once-per-30-days limit. Here we only pick a calm moment inside the visit.
 */
type Reason = 'returning_seller' | 'returning_buyer' | 'returning_no_contact'

const QUESTION: Record<Reason, string> = {
  returning_seller: 'إيه رأيك في تجربتك كبايع على Xعفش لحد دلوقتي؟',
  returning_buyer: 'إيه رأيك في تجربتك وأنت بتدوّر على عفش في Xعفش؟',
  returning_no_contact: 'عرضت طقمك من أسبوع — إيه رأيك في تجربتك لحد دلوقتي؟',
}

const FACES: [number, string, string][] = [[1, '😞', 'سيئة'], [2, '🙁', 'مش ولا بد'], [3, '😐', 'عادية'], [4, '🙂', 'كويسة'], [5, '😍', 'ممتازة']]
const WAIT_MS = 30_000
const SESSION_KEY = 'x3afsh_csat_checked'

export function SurveyProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth()
  const location = useLocation()
  const [reason, setReason] = useState<Reason | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [armedAt, setArmedAt] = useState<number | null>(null)

  // Start the clock once per visit for a signed-in, non-owner user
  useEffect(() => {
    if (!session || !profile || profile.is_owner) return
    try { if (sessionStorage.getItem(SESSION_KEY) === '1') return } catch { /* ignore */ }
    setArmedAt(Date.now())
  }, [session, profile])

  // After the user has spent a little while on the site, on a calm page, ask the database whether to ask
  useEffect(() => {
    if (!armedAt || reason) return
    const busyPage = /^\/(new|edit|login|account)/.test(location.pathname)
    const t = window.setTimeout(async () => {
      if (busyPage || document.querySelector('.modal-backdrop')) return
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
      setArmedAt(null)
      const { data } = await supabase.rpc('csat_due')
      if (data) { setReason(data as Reason); setScore(null); setComment(''); track('csat_shown', { trigger: data }) }
    }, Math.max(0, WAIT_MS - (Date.now() - armedAt)))
    return () => window.clearTimeout(t)
  }, [armedAt, reason, location.pathname])

  async function submit(skipped: boolean) {
    if (!reason || !session) return
    setBusy(true)
    await supabase.from('satisfaction_responses').insert({ user_id: session.user.id, trigger: reason, score: skipped ? null : score, comment: skipped ? null : (comment.trim() || null), skipped })
    setBusy(false)
    track(skipped ? 'csat_skipped' : 'csat_answered', { trigger: reason, score: skipped ? null : score, has_comment: !!comment.trim() })
    setReason(null)
  }

  return (
    <>
      {children}
      {reason && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="csat-title">
          <div className="modal">
            <button className="modal-close" aria-label="تخطّي" onClick={() => submit(true)}>×</button>
            <h2 id="csat-title" style={{ marginTop: 4 }}>{QUESTION[reason]}</h2>
            <p className="meta">سؤال واحد بس، بياخد ثانية.</p>
            <div className="faces">
              {FACES.map(([v, f, l]) => (
                <button key={v} type="button" className={score === v ? 'on' : ''} onClick={() => setScore(v)} aria-label={l}>
                  <span>{f}</span><small>{l}</small>
                </button>
              ))}
            </div>
            {score != null && (
              <div className="field" style={{ marginTop: 12 }}>
                <textarea className="input" style={{ minHeight: 70 }} placeholder="عايز تضيف حاجة؟ (اختياري)" value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn-primary" disabled={score == null || busy} onClick={() => submit(false)}>ابعت</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => submit(true)}>مش دلوقتي</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

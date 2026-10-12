import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { track } from '../lib/analytics'

type Trigger = 'listing_published' | 'negotiation_ended' | 'first_conversation'

interface SurveyState {
  /** Rule G1/G2: ask "how was your experience?" after a key action, at most once per 30 days. */
  askSatisfaction: (trigger: Trigger) => void
}

const Ctx = createContext<SurveyState>({ askSatisfaction: () => {} })

const FACES: [number, string, string][] = [[1, '😞', 'سيئة'], [2, '🙁', 'مش ولا بد'], [3, '😐', 'عادية'], [4, '🙂', 'كويسة'], [5, '😍', 'ممتازة']]

export function SurveyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [trigger, setTrigger] = useState<Trigger | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const askSatisfaction = useCallback(async (t: Trigger) => {
    if (!session) return
    const { data } = await supabase.rpc('can_ask_satisfaction')
    if (data === true) { setTrigger(t); setScore(null); setComment(''); track('csat_shown', { trigger: t }) }
  }, [session])

  async function submit(skipped: boolean) {
    if (!trigger || !session) return
    setBusy(true)
    await supabase.from('satisfaction_responses').insert({ user_id: session.user.id, trigger, score: skipped ? null : score, comment: skipped ? null : (comment.trim() || null), skipped })
    setBusy(false)
    track(skipped ? 'csat_skipped' : 'csat_answered', { trigger, score: skipped ? null : score, has_comment: !!comment.trim() })
    setTrigger(null)
  }

  return (
    <Ctx.Provider value={{ askSatisfaction }}>
      {children}
      {trigger && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="csat-title">
          <div className="modal">
            <button className="modal-close" aria-label="تخطّي" onClick={() => submit(true)}>×</button>
            <h2 id="csat-title" style={{ marginTop: 4 }}>تجربتك على Xعفش إيه؟</h2>
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
    </Ctx.Provider>
  )
}

export function useSurvey() {
  return useContext(Ctx)
}

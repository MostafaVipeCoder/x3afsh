import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/analytics'

const LISTING_REASONS: [string, string][] = [
  ['scam', 'نصب أو إعلان وهمي'],
  ['wrong_info', 'بيانات أو صور مش حقيقية'],
  ['duplicate', 'إعلان مكرر'],
  ['offensive', 'محتوى مسيء'],
  ['sold', 'اتباع والبايع مش بيحدّث'],
  ['other', 'غير ذلك'],
]
const REVIEW_REASONS: [string, string][] = [
  ['offensive', 'تعليق مسيء'],
  ['spam', 'إعلان أو سبام'],
  ['fake', 'تقييم مزيف'],
  ['other', 'غير ذلك'],
]

/** Decision 5 / rule C9: report a listing or a comment. 3 reports from different users auto-hide it. */
export default function ReportButton({ targetType, targetId, compact }: { targetType: 'listing' | 'review'; targetId: string; compact?: boolean }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const reasons = targetType === 'listing' ? LISTING_REASONS : REVIEW_REASONS

  async function submit() {
    if (!reason) return
    setBusy(true)
    const text = reason + (note.trim() ? `: ${note.trim()}` : '')
    const { error } = await supabase.from('reports').insert({ reporter_id: session!.user.id, target_type: targetType, target_id: targetId, reason: text })
    setBusy(false)
    if (error) { setDone(error.message.includes('duplicate') ? 'بلّغت عن ده قبل كده. شكرًا.' : 'حصلت مشكلة، جرّب تاني.'); return }
    track('report_submitted', { target_type: targetType, target_id: targetId, reason })
    setDone('وصل البلاغ. هنراجعه، وشكرًا إنك بتساعدنا نحافظ على المنصة.')
  }

  return (
    <>
      <button
        type="button"
        className={compact ? 'btn btn-ghost btn-sm' : 'btn btn-ghost'}
        style={{ color: 'var(--muted)', padding: compact ? '2px 6px' : undefined, fontSize: compact ? 12 : undefined }}
        onClick={() => { if (!session) { navigate(`/login?next=${encodeURIComponent(window.location.hash.slice(1))}`); return } setOpen(true); track('report_opened', { target_type: targetType }) }}
      >
        ⚑ {compact ? 'بلّغ' : 'بلّغ عن الإعلان'}
      </button>
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <button className="modal-close" aria-label="إغلاق" onClick={() => setOpen(false)}>×</button>
            {done ? (
              <>
                <h2>شكرًا</h2>
                <p>{done}</p>
                <button className="btn btn-primary" onClick={() => setOpen(false)}>تمام</button>
              </>
            ) : (
              <>
                <h2>{targetType === 'listing' ? 'إيه المشكلة في الإعلان ده؟' : 'إيه المشكلة في التعليق ده؟'}</h2>
                <div className="choice-list" style={{ gap: 6 }}>
                  {reasons.map(([s, l]) => (
                    <button key={s} type="button" className={`btn ${reason === s ? 'btn-primary' : 'btn-outline'}`} style={{ padding: 9 }} onClick={() => setReason(s)}>{l}</button>
                  ))}
                </div>
                <input className="input" style={{ marginTop: 8 }} placeholder="تفاصيل (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />
                <p className="meta" style={{ marginTop: 8 }}>بلاغك سري. لو 3 أشخاص بلّغوا عن نفس الحاجة بتتخفي تلقائيًا لحد ما تتراجع.</p>
                <div className="row">
                  <button className="btn btn-accent" disabled={!reason || busy} onClick={submit}>{busy ? '…' : 'ابعت البلاغ'}</button>
                  <button className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

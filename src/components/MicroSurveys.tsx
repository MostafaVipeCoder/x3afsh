import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/analytics'

/**
 * One-question surveys from docs/04 section 6, mounted once in App:
 *  - draft_abandoned: user has a draft older than 10 minutes → "ليه مكملتش؟" (once per draft)
 *  - missing_features: 14 days after signup → "إيه اللي ينقص المنصة؟" (once)
 */
export default function MicroSurveys() {
  const { session, profile } = useAuth()
  const location = useLocation()
  const [draft, setDraft] = useState<{ id: string; title: string } | null>(null)
  const [missing, setMissing] = useState(false)
  const [choice, setChoice] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!session || !profile || profile.is_owner || draft || missing) return
    // never interrupt someone who is on the listing form itself
    if (location.pathname.startsWith('/new') || location.pathname.startsWith('/edit')) return
    ;(async () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString()
      const { data: drafts } = await supabase.from('listings').select('id, title').eq('seller_id', session.user.id).eq('status', 'draft').lt('created_at', tenMinAgo).order('created_at', { ascending: false }).limit(5)
      if (drafts && drafts.length) {
        const { data: asked } = await supabase.from('micro_surveys').select('listing_id').eq('kind', 'draft_abandoned').in('listing_id', drafts.map((d) => d.id))
        const askedIds = new Set(((asked as { listing_id: string }[]) ?? []).map((a) => a.listing_id))
        const d = drafts.find((x) => !askedIds.has(x.id))
        if (d) { setDraft(d as { id: string; title: string }); track('draft_nudge_shown', { listing_id: d.id }); return }
      }
      const memberDays = (Date.now() - new Date(profile.created_at).getTime()) / 86400000
      if (memberDays >= 14) {
        const { data: m } = await supabase.from('micro_surveys').select('id').eq('kind', 'missing_features').limit(1)
        if (!m || m.length === 0) { setMissing(true); track('missing_features_shown') }
      }
    })()
  }, [session, profile, location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  async function answerDraft(skipped: boolean) {
    setBusy(true)
    await supabase.from('micro_surveys').insert({ user_id: session!.user.id, kind: 'draft_abandoned', listing_id: draft!.id, choices: skipped || !choice ? null : [choice], free_text: text.trim() || null, skipped })
    setBusy(false)
    track('draft_nudge_answered', { listing_id: draft!.id, choice: skipped ? null : choice })
    setDraft(null); setChoice(null); setText('')
  }

  async function answerMissing(skipped: boolean) {
    setBusy(true)
    await supabase.from('micro_surveys').insert({ user_id: session!.user.id, kind: 'missing_features', free_text: skipped ? null : (text.trim() || null), skipped })
    setBusy(false)
    track('missing_features_answered', { skipped, length: text.trim().length })
    setMissing(false); setText('')
  }

  if (draft) {
    const opts: [string, string][] = [['photos_hard', 'رفع الصور صعب'], ['price_unsure', 'مش عارف أحط سعر إيه'], ['later', 'هرجع أكمّله بعدين'], ['other', 'غير ذلك']]
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal">
          <button className="modal-close" aria-label="تخطّي" onClick={() => answerDraft(true)} disabled={busy}>×</button>
          <h2>عندك طقم مكملتش نشره</h2>
          <p className="meta">"{draft.title || 'بدون عنوان'}" — إيه اللي وقفك؟</p>
          <div className="chips">
            {opts.map(([s, l]) => <button key={s} type="button" className={choice === s ? 'on' : ''} onClick={() => setChoice(s)}>{l}</button>)}
          </div>
          {choice === 'other' && <input className="input" placeholder="قولنا…" value={text} onChange={(e) => setText(e.target.value)} />}
          <div className="row" style={{ marginTop: 10 }}>
            <Link className="btn btn-accent" to={`/edit/${draft.id}`} onClick={() => answerDraft(!choice)}>كمّل الطقم دلوقتي</Link>
            <button className="btn btn-ghost" disabled={busy || !choice} onClick={() => answerDraft(false)}>ابعت وبس</button>
          </div>
        </div>
      </div>
    )
  }

  if (missing) {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal">
          <button className="modal-close" aria-label="تخطّي" onClick={() => answerMissing(true)} disabled={busy}>×</button>
          <h2>بقالك أسبوعين معانا — إيه اللي ينقص المنصة؟</h2>
          <p className="meta">أي حاجة في بالك، حتى لو صغيرة.</p>
          <textarea className="input" style={{ minHeight: 90 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="مثلًا: نفسي أقدر أفلتر بالسعر من وإلى…" />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => answerMissing(false)}>ابعت</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => answerMissing(true)}>مفيش حاجة دلوقتي</button>
          </div>
        </div>
      </div>
    )
  }
  return null
}

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Review, RatingStats } from '../lib/types'
import { countNonSpace, humanizeError, timeAgo } from '../lib/format'
import { track } from '../lib/analytics'
import Stars from './Stars'
import ReportButton from './ReportButton'

const MIN_COMMENT = 15

interface Props { listingId: string; sellerId: string; listingStatus: string }

export default function Reviews({ listingId, sellerId, listingStatus }: Props) {
  const { session } = useAuth()
  const me = session?.user.id
  const isSeller = me === sellerId
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<RatingStats | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [started, setStarted] = useState(false)

  async function load() {
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from('reviews').select('*, author:profiles(display_name)').eq('listing_id', listingId).order('created_at', { ascending: true }),
      supabase.from('listing_rating_stats').select('*').eq('listing_id', listingId).maybeSingle(),
    ])
    setReviews((r as unknown as Review[]) ?? [])
    setStats((s as RatingStats | null) ?? null)
  }
  useEffect(() => { load() }, [listingId]) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = reviews.find((r) => r.author_id === me && r.rating != null)
  useEffect(() => { if (mine && !started) { setRating(mine.rating); setBody(mine.body) } }, [mine]) // eslint-disable-line react-hooks/exhaustive-deps

  const count = countNonSpace(body)
  const needsMore = rating != null && count < MIN_COMMENT
  const canPost = body.trim().length > 0 && !needsMore

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (needsMore) { track('review_blocked_short', { listing_id: listingId, length: count }); return }
    setBusy(true)
    let err
    if (mine) {
      ;({ error: err } = await supabase.from('reviews').update({ rating, body: body.trim() }).eq('id', mine.id))
    } else {
      ;({ error: err } = await supabase.from('reviews').insert({ listing_id: listingId, author_id: me, rating, body: body.trim() }))
    }
    setBusy(false)
    if (err) { setError(humanizeError(err.message)); return }
    track('review_posted', { listing_id: listingId, rating, length: count, edited: !!mine })
    if (!mine) { setBody(''); setRating(null) }
    setStarted(false)
    load()
  }

  async function submitReply(parentId: string) {
    if (!replyBody.trim()) return
    setBusy(true); setError(null)
    const { error: err } = await supabase.from('reviews').insert({ listing_id: listingId, author_id: me, parent_id: parentId, body: replyBody.trim() })
    setBusy(false)
    if (err) { setError(humanizeError(err.message)); return }
    track('review_reply_posted', { listing_id: listingId, by_seller: isSeller })
    setReplyTo(null); setReplyBody('')
    load()
  }

  const top = reviews.filter((r) => !r.parent_id)
  const repliesOf = (id: string) => reviews.filter((r) => r.parent_id === id)

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>التقييمات والتعليقات</h2>
          {stats && stats.rating_count > 0 && (
            <span className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Stars value={stats.avg_rating} size={16} /> <b>{stats.avg_rating}</b> ({stats.rating_count} تقييم)
            </span>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}

        {listingStatus === 'published' && (session ? (
          <form onSubmit={submit} style={{ marginTop: 12, background: 'var(--bg)', padding: 12, borderRadius: 10 }}>
            {!isSeller && (
              <div className="field" style={{ marginBottom: 8 }}>
                <label>{mine ? 'تقييمك (تقدر تعدّله)' : 'قيّم الطقم'} <span className="meta">— اختياري</span></label>
                <Stars value={rating} onChange={(v) => { setRating(v === rating ? null : v); if (!started) { setStarted(true); track('review_started', { listing_id: listingId, with_rating: true }) } }} size={28} />
              </div>
            )}
            <div className="field" style={{ marginBottom: 8 }}>
              <textarea
                className="input"
                style={{ minHeight: 80 }}
                placeholder={isSeller ? 'رد على الناس أو ضيف معلومة عن الطقم…' : 'اكتب رأيك أو اسأل البايع سؤال…'}
                value={body}
                onFocus={() => { if (!started) { setStarted(true); track('review_started', { listing_id: listingId, with_rating: false }) } }}
                onChange={(e) => setBody(e.target.value)}
              />
              {rating != null && (
                <div className={`hint ${needsMore ? 'err' : 'ok'}`}>
                  {needsMore ? `عشان التقييم يتحسب، اكتب ${MIN_COMMENT - count} حرف كمان (${count} من ${MIN_COMMENT})` : '✓ التعليق كافي'}
                </div>
              )}
            </div>
            <button className="btn btn-primary btn-sm" disabled={!canPost || busy}>{busy ? '…' : mine ? 'حفظ التعديل' : rating != null ? 'انشر التقييم' : 'انشر التعليق'}</button>
          </form>
        ) : (
          <p className="meta" style={{ marginTop: 10 }}><Link to={`/login?next=/listing/${listingId}`}>سجّل دخول</Link> عشان تقيّم أو تعلّق.</p>
        ))}

        {top.length === 0 ? (
          <p className="meta" style={{ marginTop: 12 }}>لسه مفيش تعليقات. كن أول واحد.</p>
        ) : (
          <div style={{ marginTop: 14 }}>
            {top.map((r) => (
              <div key={r.id} className="review">
                <div className="review-head">
                  <b>{r.author?.display_name || 'مستخدم'}</b>
                  {r.author_id === sellerId && <span className="pill pill-published">البايع</span>}
                  {r.rating != null && <Stars value={r.rating} size={14} />}
                  <span className="meta">{timeAgo(r.created_at)}</span>
                  {session && r.author_id !== me && <span style={{ marginInlineStart: 'auto' }}><ReportButton targetType="review" targetId={r.id} compact /></span>}
                </div>
                <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{r.body}</p>
                {session && (isSeller || r.author_id === me) && replyTo !== r.id && r.author_id !== me && (
                  <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => setReplyTo(r.id)}>رد</button>
                )}
                {repliesOf(r.id).map((rep) => (
                  <div key={rep.id} className="review reply">
                    <div className="review-head">
                      <b>{rep.author?.display_name || 'مستخدم'}</b>
                      {rep.author_id === sellerId && <span className="pill pill-published">البايع</span>}
                      <span className="meta">{timeAgo(rep.created_at)}</span>
                    </div>
                    <p style={{ margin: '2px 0', whiteSpace: 'pre-wrap' }}>{rep.body}</p>
                  </div>
                ))}
                {replyTo === r.id && (
                  <div className="reply" style={{ display: 'flex', gap: 6 }}>
                    <input className="input" placeholder="اكتب ردك…" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} autoFocus />
                    <button className="btn btn-primary btn-sm" disabled={busy || !replyBody.trim()} onClick={() => submitReply(r.id)}>ابعت</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setReplyTo(null); setReplyBody('') }}>إلغاء</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

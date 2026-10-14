import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, imageUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Negotiation, Offer, OfferType } from '../lib/types'
import { NEGOTIATION_LABEL } from '../lib/types'
import { formatPrice, humanizeError, timeAgo } from '../lib/format'
import { track, pageView } from '../lib/analytics'

export default function NegotiationPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const me = session?.user.id
  const [n, setN] = useState<Negotiation | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [counter, setCounter] = useState('')
  const [showCounter, setShowCounter] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const [{ data: neg }, { data: off }] = await Promise.all([
      supabase.from('my_negotiations').select('*').eq('id', id!).maybeSingle(),
      supabase.from('negotiation_offers').select('*').eq('negotiation_id', id!).order('created_at'),
    ])
    setN((neg as Negotiation | null) ?? null)
    setOffers((off as Offer[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!session) return
    pageView('negotiation', { negotiation_id: id })
    load()
    const ch = supabase.channel(`neg-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'negotiations', filter: `id=eq.${id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, session]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <div className="container"><div className="alert alert-info">سجّل دخول عشان تشوف التفاوض.</div><Link className="btn btn-primary" to={`/login?next=/negotiation/${id}`}>دخول</Link></div>
  if (loading) return <div className="spinner" />
  if (!n) return <div className="container"><div className="empty"><h2>التفاوض ده مش موجود</h2></div></div>

  const isBuyer = n.buyer_id === me
  const lastPrice = [...offers].reverse().find((o) => o.price != null)?.price ?? n.opening_price
  const myTurn = n.status === 'open' && n.last_offer_by !== me
  const roundsLeft = 10 - n.round_count
  const daysLeft = Math.max(0, Math.round((new Date(n.expires_at).getTime() - Date.now()) / 86400000))

  async function respond(type: OfferType, price?: number) {
    setBusy(true); setError(null)
    const { error: err } = await supabase.rpc('respond_to_negotiation', { p_negotiation: n!.id, p_type: type, p_price: price ?? null })
    setBusy(false)
    if (err) { setError(humanizeError(err.message)); return }
    track('negotiation_replied', { negotiation_id: n!.id, type, price: price ?? lastPrice, role: isBuyer ? 'buyer' : 'seller', round: n!.round_count })
    if (type === 'accept' || type === 'reject') {
      track('negotiation_ended', { negotiation_id: n!.id, result: type === 'accept' ? 'agreed' : 'rejected', rounds: n!.round_count, final_price: type === 'accept' ? lastPrice : null, listed_price: n!.listed_price, opening_price: n!.opening_price })
    }
    setShowCounter(false); setCounter('')
    load()
  }

  function who(o: Offer) { return o.by_user_id === me ? 'أنت' : (n!.other_name || (o.by_user_id === n!.seller_id ? 'البايع' : 'المشتري')) }
  function label(o: Offer) {
    if (o.type === 'offer') return `عرض ${formatPrice(o.price)}`
    if (o.type === 'counter') return `عرض مضاد ${formatPrice(o.price)}`
    if (o.type === 'accept') return `قبل ${formatPrice(o.price)} ✓`
    return 'رفض ✕'
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Link to={`/listing/${n.listing_id}`} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, color: 'var(--ink)', marginBottom: 12 }}>
        {n.listing_image ? <img className="thumb" src={imageUrl(n.listing_image)} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} /> : null}
        <div className="grow">
          <b>{n.listing_title}</b>
          <div className="meta">السعر المعروض {formatPrice(n.listed_price)} · {isBuyer ? 'البايع' : 'المشتري'}: {n.other_name || '—'}</div>
        </div>
      </Link>

      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ margin: 0 }}>التفاوض</h1>
          <span className={`pill ${n.status === 'open' ? 'pill-published' : n.status === 'agreed' ? 'pill-published' : 'pill-sold'}`}>{NEGOTIATION_LABEL[n.status]}</span>
        </div>

        {n.status === 'agreed' && (
          <div className="alert alert-success" style={{ marginTop: 10 }}>
            اتفقتوا على <b>{formatPrice(n.final_price)}</b>. كمّلوا الاتفاق بينكم مباشرة (واتساب أو اتصال). الاتفاق هنا مبدئي ومش ملزم.
          </div>
        )}
        {n.status === 'open' && (
          <p className="meta" style={{ marginTop: 6 }}>
            {myTurn ? '🔔 دورك ترد' : `مستني رد ${n.other_name || 'الطرف التاني'}`} · فاضل {roundsLeft} ردود · ينتهي تلقائيًا بعد {daysLeft} يوم لو مفيش رد
          </p>
        )}
        {n.status === 'expired' && <p className="meta">عدى 7 أيام من غير رد فاتقفل التفاوض. تقدر تبدأ واحد جديد من صفحة الطقم.</p>}
        {n.status === 'closed' && <p className="meta">الطقم اتباع أو اتشال من العرض.</p>}

        <div className="timeline">
          {offers.map((o) => (
            <div key={o.id} className={`offer ${o.by_user_id === me ? 'mine' : ''} ${o.type}`}>
              <div className="meta" style={{ fontSize: 12 }}>{who(o)} · {timeAgo(o.created_at)}</div>
              <div style={{ fontWeight: 700 }}>{label(o)}</div>
            </div>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {myTurn && (
          <div style={{ marginTop: 14 }}>
            {!showCounter ? (
              <div className="row">
                <button className="btn btn-primary" disabled={busy} onClick={() => respond('accept')}>اقبل {formatPrice(lastPrice)}</button>
                <button className="btn btn-outline" disabled={busy || roundsLeft <= 0} onClick={() => setShowCounter(true)}>عرض مضاد</button>
                <button className="btn btn-danger" disabled={busy} onClick={() => { if (window.confirm('ترفض وتقفل التفاوض؟')) respond('reject') }}>ارفض</button>
              </div>
            ) : (
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="counter">سعرك المقترح بالجنيه</label>
                  <input id="counter" className="input" type="number" inputMode="numeric" min={1} value={counter} onChange={(e) => setCounter(e.target.value)} autoFocus />
                </div>
                <button className="btn btn-accent" disabled={busy || !(Number(counter) > 0)} onClick={() => respond('counter', Number(counter))}>ابعت العرض</button>
                <button className="btn btn-ghost" onClick={() => setShowCounter(false)}>إلغاء</button>
              </div>
            )}
          </div>
        )}
      </div></div>
    </div>
  )
}

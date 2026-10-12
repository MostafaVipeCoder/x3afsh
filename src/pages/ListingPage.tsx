import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, imageUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Listing, Negotiation, Profile } from '../lib/types'
import { formatPrice, humanizeError, timeAgo } from '../lib/format'
import { track, pageView } from '../lib/analytics'
import Reviews from '../components/Reviews'

export default function ListingPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [listing, setListing] = useState<Listing | null>(null)
  const [seller, setSeller] = useState<Profile | null>(null)
  const [openNeg, setOpenNeg] = useState<Negotiation | null>(null)
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [showNeg, setShowNeg] = useState(false)
  const [offer, setOffer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const swipes = useRef(new Set<number>())

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase
      .from('listings')
      .select('*, listing_images(id, listing_id, storage_path, position, angle), categories(name_ar), governorates(name_ar)')
      .eq('id', id)
      .maybeSingle()
      .then(async ({ data }) => {
        const l = data as Listing | null
        setListing(l)
        setLoading(false)
        if (l) {
          pageView('listing', { listing_id: l.id })
          if (session) {
            const [{ data: p }, { data: n }] = await Promise.all([
              supabase.from('profiles').select('*').eq('id', l.seller_id).maybeSingle(),
              supabase.from('negotiations').select('*').eq('listing_id', l.id).eq('buyer_id', session.user.id).eq('status', 'open').maybeSingle(),
            ])
            setSeller((p as Profile) ?? null)
            setOpenNeg((n as Negotiation) ?? null)
          }
        }
      })
  }, [id, session])

  useEffect(() => () => {
    if (swipes.current.size > 1 && listing) track('listing_images_swiped', { listing_id: listing.id, images_seen: swipes.current.size })
  }, [listing])

  if (loading) return <div className="spinner" />
  if (!listing) {
    return (
      <div className="container"><div className="empty"><div className="big">🔍</div><h2>الطقم ده مش موجود</h2><p>يمكن اتباع أو اتشال.</p><Link className="btn btn-outline" to="/">ارجع للرئيسية</Link></div></div>
    )
  }

  const images = [...(listing.listing_images ?? [])].sort((a, b) => a.position - b.position)
  const isOwner = session?.user.id === listing.seller_id
  const phone = seller?.phone ?? ''
  const waText = encodeURIComponent(`السلام عليكم، شفت "${listing.title}" على Xعفش وحابب أسأل عنه.`)
  const loginNext = `/login?next=/listing/${listing.id}`

  function pick(i: number) { setIdx(i); swipes.current.add(i) }

  async function contact(channel: 'call' | 'whatsapp') {
    if (!session) { navigate(loginNext); return }
    track(channel === 'call' ? 'contact_call_clicked' : 'contact_whatsapp_clicked', { listing_id: listing!.id, source: 'listing_page', price: listing!.price })
    // Recorded first so the post-contact survey is scheduled even if the user leaves the page immediately
    await supabase.from('contact_clicks').insert({ user_id: session.user.id, listing_id: listing!.id, channel, source: 'listing_page' })
    const digits = phone.replace(/\D/g, '')
    window.location.href = channel === 'call' ? `tel:${phone}` : `https://wa.me/${digits}?text=${waText}`
  }

  async function startNegotiation() {
    const price = Number(offer)
    setError(null)
    if (!(price > 0) || price >= (listing!.price ?? 0)) { setError('اكتب سعر أقل من السعر المعروض'); return }
    setBusy(true)
    const { data, error: err } = await supabase.rpc('start_negotiation', { p_listing: listing!.id, p_price: price })
    setBusy(false)
    if (err) { setError(humanizeError(err.message)); track('negotiation_start_failed', { listing_id: listing!.id, reason: err.message.slice(0, 60) }); return }
    track('negotiation_started', { listing_id: listing!.id, listed_price: listing!.price, opening_price: price, discount_pct: Math.round((1 - price / (listing!.price ?? price)) * 100) })
    navigate(`/negotiation/${data as string}`)
  }

  async function openChat() {
    if (!session) { navigate(loginNext); return }
    setBusy(true); setError(null)
    const { data, error: err } = await supabase.rpc('get_or_create_conversation', { p_listing: listing!.id })
    setBusy(false)
    if (err) { setError(humanizeError(err.message)); return }
    track('conversation_opened', { listing_id: listing!.id, source: 'listing_page' })
    navigate(`/chat/${data as string}`)
  }

  return (
    <div className="container">
      <div className="detail">
        <div>
          <div className="gallery">
            <div className="main">
              {images[idx] ? <img src={imageUrl(images[idx].storage_path)} alt={listing.title} /> : <span className="meta">بدون صور</span>}
            </div>
            {images.length > 1 && (
              <div className="thumbs">
                {images.map((im, i) => (
                  <button key={im.id} className={i === idx ? 'active' : ''} onClick={() => pick(i)} aria-label={`صورة ${i + 1}`}>
                    <img src={imageUrl(im.storage_path)} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="card"><div className="card-body">
            {listing.status === 'sold' && <div className="alert alert-info">الطقم ده اتباع</div>}
            <h1>{listing.title}</h1>
            <p className="price-big">{formatPrice(listing.price)}</p>
            <p className="meta">
              {listing.categories?.name_ar} · {listing.governorates?.name_ar}
              {listing.published_at && ` · ${timeAgo(listing.published_at)}`}
            </p>
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '12px 0' }} />
            <h3>الوصف</h3>
            <p className="desc">{listing.description}</p>
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '12px 0' }} />

            {error && <div className="alert alert-error">{error}</div>}

            {isOwner ? (
              <div className="row">
                <Link className="btn btn-outline" to={`/edit/${listing.id}`}>عدّل الطقم</Link>
                <Link className="btn btn-ghost" to="/inbox">الوارد</Link>
              </div>
            ) : listing.status !== 'published' ? null : session ? (
              <>
                <p><b>البايع:</b> {seller?.display_name || '—'}</p>

                {openNeg ? (
                  <Link className="btn btn-outline btn-block" to={`/negotiation/${openNeg.id}`}>عندك تفاوض مفتوح على الطقم ده — افتحه</Link>
                ) : !showNeg ? (
                  <button className="btn btn-accent btn-block" onClick={() => { setShowNeg(true); track('negotiation_opened_form', { listing_id: listing.id }) }}>فاوض على السعر</button>
                ) : (
                  <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 10 }}>
                    <label htmlFor="offer" style={{ fontWeight: 700 }}>السعر اللي تحب تشتري بيه</label>
                    <div className="row" style={{ marginTop: 6 }}>
                      <input id="offer" className="input" type="number" inputMode="numeric" min={1} max={(listing.price ?? 1) - 1} placeholder={`أقل من ${formatPrice(listing.price)}`} value={offer} onChange={(e) => setOffer(e.target.value)} autoFocus />
                      <button className="btn btn-accent" disabled={busy || !(Number(offer) > 0)} onClick={startNegotiation}>ابعت العرض</button>
                    </div>
                    <p className="meta" style={{ margin: '6px 0 0' }}>البايع يقدر يقبل أو يرفض أو يرد بسعر تاني. أقصى 10 ردود.</p>
                  </div>
                )}

                <div className="contact-bar">
                  <button className="btn btn-primary" onClick={openChat} disabled={busy}>راسل البايع</button>
                  <button className="btn btn-whatsapp" onClick={() => contact('whatsapp')} disabled={!phone}>واتساب</button>
                  <button className="btn btn-outline" onClick={() => contact('call')} disabled={!phone}>اتصل</button>
                </div>
                <p className="meta" style={{ marginTop: 10 }}>البيع بيتم بينك وبين البايع مباشرة. Xعفش مش طرف في الصفقة ومفيش عمولة.</p>
              </>
            ) : (
              <>
                <div className="alert alert-info">سجّل دخول عشان تفاوض أو تراسل البايع أو تشوف رقمه.</div>
                <Link className="btn btn-primary btn-block" to={loginNext}>دخول برقم الموبايل</Link>
              </>
            )}
          </div></div>
        </div>
      </div>

      <Reviews listingId={listing.id} sellerId={listing.seller_id} listingStatus={listing.status} />

      {!isOwner && listing.status === 'published' && session && (
        <div className="sticky-bottom">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={openChat}>راسل</button>
          <button className="btn btn-whatsapp" style={{ flex: 1 }} onClick={() => contact('whatsapp')} disabled={!phone}>واتساب</button>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => contact('call')} disabled={!phone}>اتصل</button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, imageUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Listing, Profile } from '../lib/types'
import { formatPrice, timeAgo } from '../lib/format'
import { track, pageView } from '../lib/analytics'

export default function ListingPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [listing, setListing] = useState<Listing | null>(null)
  const [seller, setSeller] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
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
            const { data: p } = await supabase.from('profiles').select('*').eq('id', l.seller_id).maybeSingle()
            setSeller((p as Profile) ?? null)
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

  function pick(i: number) { setIdx(i); swipes.current.add(i) }

  async function contact(channel: 'call' | 'whatsapp') {
    if (!session) { navigate(`/login?next=/listing/${listing!.id}`); return }
    track(channel === 'call' ? 'contact_call_clicked' : 'contact_whatsapp_clicked', { listing_id: listing!.id, source: 'listing_page', price: listing!.price })
    // Recorded first so the post-contact survey is scheduled even if the user leaves the page immediately
    await supabase.from('contact_clicks').insert({ user_id: session.user.id, listing_id: listing!.id, channel, source: 'listing_page' })
    const digits = phone.replace(/\D/g, '')
    window.location.href = channel === 'call' ? `tel:${phone}` : `https://wa.me/${digits}?text=${waText}`
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

            {isOwner ? (
              <div className="row">
                <Link className="btn btn-outline" to={`/edit/${listing.id}`}>عدّل الطقم</Link>
                <Link className="btn btn-ghost" to="/my">أطقمي</Link>
              </div>
            ) : listing.status !== 'published' ? null : session ? (
              <>
                <p><b>البايع:</b> {seller?.display_name || '—'}</p>
                <div className="contact-bar">
                  <button className="btn btn-whatsapp" onClick={() => contact('whatsapp')} disabled={!phone}>واتساب</button>
                  <button className="btn btn-primary" onClick={() => contact('call')} disabled={!phone}>اتصل</button>
                </div>
                <p className="meta" style={{ marginTop: 10 }}>البيع بيتم بينك وبين البايع مباشرة. Xعفش مش طرف في الصفقة ومفيش عمولة.</p>
              </>
            ) : (
              <>
                <div className="alert alert-info">سجّل دخول عشان تشوف رقم البايع وتتواصل معاه.</div>
                <Link className="btn btn-primary btn-block" to={`/login?next=/listing/${listing.id}`}>دخول برقم الموبايل</Link>
              </>
            )}
          </div></div>
        </div>
      </div>

      {!isOwner && listing.status === 'published' && session && (
        <div className="sticky-bottom">
          <button className="btn btn-whatsapp" style={{ flex: 1 }} onClick={() => contact('whatsapp')} disabled={!phone}>واتساب</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => contact('call')} disabled={!phone}>اتصل</button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, imageUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Listing, ListingStatus } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'
import { formatPrice, humanizeError } from '../lib/format'
import { track, pageView } from '../lib/analytics'

export default function MyListings() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('listings')
      .select('*, listing_images(id, listing_id, storage_path, position, angle), categories(name_ar), governorates(name_ar)')
      .eq('seller_id', session!.user.id)
      .order('created_at', { ascending: false })
    setItems((data as unknown as Listing[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!session) { navigate('/login?next=/my'); return }
    pageView('my_listings')
    load()
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(l: Listing, status: ListingStatus) {
    setError(null)
    const { error: err } = await supabase.from('listings').update({ status }).eq('id', l.id)
    if (err) { setError(humanizeError(err.message)); return }
    if (status === 'sold') track('listing_marked_sold', { listing_id: l.id, days_listed: l.published_at ? Math.round((Date.now() - new Date(l.published_at).getTime()) / 86400000) : null })
    if (status === 'hidden') track('listing_hidden', { listing_id: l.id })
    load()
  }

  async function remove(l: Listing) {
    if (!window.confirm('تمسح الطقم ده نهائيًا؟')) return
    const { error: err } = await supabase.from('listings').delete().eq('id', l.id)
    if (err) { setError(humanizeError(err.message)); return }
    load()
  }

  if (!session) return null

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>أطقمي</h1>
        <Link to="/new" className="btn btn-accent" style={{ flex: '0 0 auto' }}>اعرض طقم +</Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? <div className="spinner" /> : items.length === 0 ? (
        <div className="empty"><div className="big">🪑</div><h2>لسه معرضتش حاجة</h2><p>اعرض أول طقم في دقيقتين.</p><Link className="btn btn-primary" to="/new">اعرض طقم</Link></div>
      ) : (
        <div className="card">
          {items.map((l) => {
            const first = [...(l.listing_images ?? [])].sort((a, b) => a.position - b.position)[0]
            return (
              <div className="list-row" key={l.id}>
                {first ? <img className="thumb" src={imageUrl(first.storage_path)} alt="" /> : <div className="thumb" />}
                <div className="grow">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`pill pill-${l.status}`}>{STATUS_LABEL[l.status]}</span>
                    <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title || 'بدون عنوان'}</b>
                  </div>
                  <div className="meta">{formatPrice(l.price)} · {l.categories?.name_ar ?? '—'} · {(l.listing_images ?? []).length} صور</div>
                </div>
                <div className="actions">
                  {l.status === 'draft' && <Link className="btn btn-primary btn-sm" to={`/edit/${l.id}`}>كمّل ونشر</Link>}
                  {l.status === 'published' && (
                    <>
                      <Link className="btn btn-outline btn-sm" to={`/listing/${l.id}`}>شوف</Link>
                      <Link className="btn btn-ghost btn-sm" to={`/edit/${l.id}`}>عدّل</Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => setStatus(l, 'hidden')}>اخفي</button>
                      <button className="btn btn-accent btn-sm" onClick={() => setStatus(l, 'sold')}>اتباع ✓</button>
                    </>
                  )}
                  {l.status === 'hidden' && <button className="btn btn-outline btn-sm" onClick={() => setStatus(l, 'published')}>اعرضه تاني</button>}
                  {l.status === 'sold' && <span className="meta">مبروك البيعة 🎉</span>}
                  {l.status !== 'published' && <button className="btn btn-danger btn-sm" onClick={() => remove(l)}>مسح</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRefData } from '../context/RefDataContext'
import type { Listing, ListingImage } from '../lib/types'
import ImageUploader, { MIN_IMAGES } from '../components/ImageUploader'
import { countNonSpace, humanizeError, formatPrice } from '../lib/format'
import { track, pageView } from '../lib/analytics'

const MIN_DESC = 30
type Step = 1 | 2 | 3

export default function NewListing() {
  const { id: editId } = useParams()
  const { session, profile } = useAuth()
  const { categories, governorates } = useRefData()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [listingId, setListingId] = useState<string | null>(editId ?? null)
  const [status, setStatus] = useState<Listing['status']>('draft')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [cat, setCat] = useState('')
  const [gov, setGov] = useState('')
  const [images, setImages] = useState<ListingImage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!editId)
  const published = useRef(false)
  const stepRef = useRef<Step>(1)

  useEffect(() => { stepRef.current = step }, [step])
  useEffect(() => { pageView(editId ? 'edit_listing' : 'new_listing') }, [editId])

  useEffect(() => {
    if (!session) { navigate(`/login?next=${editId ? `/edit/${editId}` : '/new'}`); return }
    // A seller must have a name and a phone number before listing (buyers call / WhatsApp that number)
    if (profile && (!profile.display_name || !profile.phone)) { navigate(`/account?first=1&next=${editId ? `/edit/${editId}` : '/new'}`); return }
    if (!gov && profile?.governorate_id && !editId) setGov(String(profile.governorate_id))
  }, [session, profile]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editId) return
    supabase.from('listings').select('*, listing_images(*)').eq('id', editId).maybeSingle().then(({ data }) => {
      const l = data as Listing | null
      if (!l) { navigate('/my'); return }
      setTitle(l.title); setDesc(l.description); setPrice(l.price ? String(l.price) : '')
      setCat(l.category_id ? String(l.category_id) : ''); setGov(l.governorate_id ? String(l.governorate_id) : '')
      setStatus(l.status); setImages(l.listing_images ?? [])
      published.current = l.status === 'published'
      setLoading(false)
    })
  }, [editId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track abandoned drafts (user leaves before publishing)
  useEffect(() => () => {
    if (listingId && !published.current && status === 'draft') track('listing_draft_abandoned', { listing_id: listingId, last_step: stepRef.current, images: images.length })
  }, [listingId, status, images.length])

  const descCount = countNonSpace(desc)
  const descOk = descCount >= MIN_DESC
  const priceNum = Number(price.replace(/[^\d.]/g, ''))
  const step1Ok = title.trim().length >= 3 && descOk && priceNum > 0 && !!cat && !!gov

  async function saveDraft(e?: FormEvent): Promise<string | null> {
    e?.preventDefault()
    setError(null)
    if (!step1Ok) { setError('كمّل كل البيانات الأول'); return null }
    setBusy(true)
    const payload = { title: title.trim(), description: desc.trim(), price: priceNum, category_id: Number(cat), governorate_id: Number(gov) }
    let id = listingId
    if (id) {
      const { error: err } = await supabase.from('listings').update(payload).eq('id', id)
      if (err) { setBusy(false); setError(humanizeError(err.message)); return null }
    } else {
      const { data, error: err } = await supabase.from('listings').insert({ ...payload, seller_id: session!.user.id }).select('id').single()
      if (err) { setBusy(false); setError(humanizeError(err.message)); return null }
      id = data.id as string
      setListingId(id)
      track('listing_draft_saved', { listing_id: id, category_id: Number(cat), price: priceNum, description_length: descCount })
    }
    setBusy(false)
    return id
  }

  async function next1(e: FormEvent) {
    const id = await saveDraft(e)
    if (id) setStep(2)
  }

  async function publish() {
    setError(null)
    if (images.length < MIN_IMAGES) { setError(`محتاج ${MIN_IMAGES} صور على الأقل`); return }
    setBusy(true)
    const { error: err } = await supabase.from('listings').update({ status: 'published' }).eq('id', listingId!)
    setBusy(false)
    if (err) {
      const msg = humanizeError(err.message)
      setError(msg)
      track('listing_publish_failed', { listing_id: listingId, missing: err.message.split(':')[1] ?? err.message })
      return
    }
    published.current = true
    setStatus('published')
    track('listing_published', { listing_id: listingId, category_id: Number(cat), governorate_id: Number(gov), price: priceNum, images: images.length, edited: !!editId })
    navigate(`/listing/${listingId}`, { replace: true })
  }

  if (!session || loading) return <div className="spinner" />

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1>{editId ? 'تعديل الطقم' : 'اعرض طقم'}</h1>
      <div className="steps">
        {[1, 2, 3].map((s) => <div key={s} className={s < step ? 'done' : s === step ? 'cur' : ''} />)}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {step === 1 && (
        <form className="card" onSubmit={next1}><div className="card-body">
          <h2>1. بيانات الطقم</h2>
          <div className="field">
            <label htmlFor="title">العنوان</label>
            <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: غرفة نوم كاملة خشب زان" maxLength={80} autoFocus />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="cat">التصنيف</label>
              <select id="cat" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">اختار…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="gov">المحافظة</label>
              <select id="gov" className="input" value={gov} onChange={(e) => setGov(e.target.value)}>
                <option value="">اختار…</option>
                {governorates.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="price">السعر بالجنيه</label>
            <input id="price" className="input" type="number" inputMode="numeric" min={1} value={price} onChange={(e) => setPrice(e.target.value)}
              onBlur={() => priceNum > 0 && track('listing_price_entered', { price: priceNum })} placeholder="مثال: 12000" />
            <div className="hint">السعر اللي حابب تبدأ منه. المشتري يقدر يفاوض عليه.</div>
          </div>
          <div className="field">
            <label htmlFor="desc">الوصف</label>
            <textarea id="desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)}
              onBlur={() => desc && track('listing_description_entered', { length: descCount, ok: descOk })}
              placeholder="الحالة، مدة الاستعمال، الخامة، المقاسات، سبب البيع، هل السعر شامل النقل…" />
            <div className={`hint ${descOk ? 'ok' : descCount > 0 ? 'err' : ''}`}>
              {descOk ? '✓ الوصف كويس' : `اكتب ${MIN_DESC - descCount} حرف كمان على الأقل (${descCount} من ${MIN_DESC})`}
            </div>
          </div>
          <button className="btn btn-primary btn-block btn-lg" disabled={!step1Ok || busy}>{busy ? 'بنحفظ…' : 'التالي: الصور'}</button>
          <p className="meta" style={{ marginTop: 8, textAlign: 'center' }}>بيتحفظ كمسودة ومش بيظهر لحد لحد ما تنشره.</p>
        </div></form>
      )}

      {step === 2 && listingId && (
        <div className="card"><div className="card-body">
          <h2>2. الصور</h2>
          <p className="meta">3 صور على الأقل من زوايا مختلفة عشان المشتري يثق في الحالة. صوّر في إضاءة كويسة.</p>
          <ImageUploader listingId={listingId} userId={session.user.id} images={images} onChange={setImages} listingPublished={status === 'published'} />
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>رجوع</button>
            <button type="button" className="btn btn-primary btn-lg" disabled={images.length < MIN_IMAGES} onClick={() => setStep(3)}>
              {images.length < MIN_IMAGES ? `ناقص ${MIN_IMAGES - images.length} صور` : 'التالي: المراجعة'}
            </button>
          </div>
        </div></div>
      )}

      {step === 3 && (
        <div className="card"><div className="card-body">
          <h2>3. راجع وانشر</h2>
          <p><b>{title}</b></p>
          <p className="price-big" style={{ fontSize: 22 }}>{formatPrice(priceNum)}</p>
          <p className="meta">{categories.find((c) => String(c.id) === cat)?.name_ar} · {governorates.find((g) => String(g.id) === gov)?.name_ar} · {images.length} صور</p>
          <p className="desc" style={{ background: 'var(--bg)', padding: 10, borderRadius: 8 }}>{desc}</p>
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>رجوع</button>
            <button type="button" className="btn btn-accent btn-lg" disabled={busy} onClick={publish}>
              {busy ? 'بننشر…' : status === 'published' ? 'حفظ التعديلات' : 'انشر الطقم'}
            </button>
          </div>
        </div></div>
      )}
    </div>
  )
}

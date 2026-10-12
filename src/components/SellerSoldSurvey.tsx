import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/analytics'
import type { Listing } from '../lib/types'
import { formatPrice } from '../lib/format'

/** Rule H15: three quick questions when the seller marks a listing as sold. */
export default function SellerSoldSurvey({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { session } = useAuth()
  const [price, setPrice] = useState('')
  const [respectful, setRespectful] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const [helped, setHelped] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(skipped: boolean) {
    setBusy(true)
    await supabase.from('seller_sold_surveys').upsert({
      listing_id: listing.id, seller_id: session!.user.id, skipped,
      sold_price: skipped || !price ? null : Number(price),
      buyer_respectful: skipped ? null : respectful,
      buyer_note: skipped ? null : (note.trim() || null),
      platform_helped: skipped ? null : helped,
    }, { onConflict: 'listing_id' })
    setBusy(false)
    track(skipped ? 'seller_survey_skipped' : 'seller_survey_answered', { listing_id: listing.id, sold_price: skipped ? null : Number(price) || null, respectful, helped })
    onClose()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button className="modal-close" aria-label="تخطّي" onClick={() => submit(true)} disabled={busy}>×</button>
        <h2>مبروك البيعة 🎉 — 3 أسئلة سريعة</h2>
        <p className="meta">{listing.title} · كان معروض بـ{formatPrice(listing.price)}</p>

        <div className="field">
          <label>اتباع بكام؟</label>
          <input className="input" type="number" inputMode="numeric" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="بالجنيه" />
        </div>

        <div className="field">
          <label>المشتري كان محترم ومفيش مشاكل؟</label>
          <div className="chips">
            <button type="button" className={respectful === true ? 'on' : ''} onClick={() => setRespectful(true)}>أيوه</button>
            <button type="button" className={respectful === false ? 'on' : ''} onClick={() => setRespectful(false)}>لأ</button>
          </div>
          {respectful === false && <input className="input" style={{ marginTop: 6 }} placeholder="إيه اللي حصل؟ (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />}
        </div>

        <div className="field">
          <label>المنصة ساعدتك تبيع؟</label>
          <div className="chips">
            <button type="button" className={helped === true ? 'on' : ''} onClick={() => setHelped(true)}>أيوه</button>
            <button type="button" className={helped === false ? 'on' : ''} onClick={() => setHelped(false)}>لأ</button>
          </div>
        </div>

        <div className="row">
          <button className="btn btn-primary" disabled={busy} onClick={() => submit(false)}>ابعت</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => submit(true)}>تخطّي</button>
        </div>
      </div>
    </div>
  )
}

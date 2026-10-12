import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Listing, Profile } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'
import { track } from '../lib/analytics'

/** What the platform owner sees on a listing page instead of buy / negotiate / contact buttons. */
export default function OwnerModeration({ listing, onChange }: { listing: Listing; onChange: () => void }) {
  const navigate = useNavigate()
  const [seller, setSeller] = useState<Profile | null>(null)
  const [reports, setReports] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', listing.seller_id).maybeSingle().then(({ data }) => setSeller((data as Profile) ?? null))
    supabase.from('reports').select('reason').eq('target_type', 'listing').eq('target_id', listing.id).then(({ data }) => setReports(((data as { reason: string }[]) ?? []).map((r) => r.reason)))
  }, [listing.id, listing.seller_id])

  async function setStatus(status: 'published' | 'hidden') {
    setBusy(true)
    await supabase.from('listings').update(status === 'published' ? { status, flagged_at: null, report_count: 0 } : { status }).eq('id', listing.id)
    setBusy(false)
    track(status === 'published' ? 'flagged_listing_restored' : 'listing_hidden', { listing_id: listing.id, by: 'owner' })
    onChange()
  }

  async function remove() {
    if (!window.confirm('تمسح الإعلان ده نهائيًا؟ مفيش رجوع.')) return
    setBusy(true)
    await supabase.from('listings').delete().eq('id', listing.id)
    track('flagged_listing_deleted', { listing_id: listing.id, by: 'owner' })
    navigate('/dashboard')
  }

  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}><div className="card-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>🛠 وضع المراجعة</h3>
        <span className={`pill pill-${listing.status}`}>{STATUS_LABEL[listing.status]}</span>
      </div>
      <p className="meta" style={{ margin: '6px 0 10px' }}>أنت بتشوف الإعلان ده كصاحب المنصة. مفيش شراء أو تفاوض من هنا.</p>
      <p style={{ margin: '0 0 4px' }}><b>البايع:</b> {seller?.display_name || '—'} · <bdi>{seller?.phone || 'بدون رقم'}</bdi>{seller && !seller.phone_verified && seller.phone ? ' (غير مؤكد)' : ''}</p>
      <p style={{ margin: '0 0 10px' }}><b>البلاغات:</b> {reports.length === 0 ? 'مفيش' : reports.join(' · ')}</p>
      <div className="row">
        {listing.status === 'published' ? (
          <button className="btn btn-outline" disabled={busy} onClick={() => setStatus('hidden')}>اخفي الإعلان</button>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={() => setStatus('published')}>اعرضه تاني</button>
        )}
        <button className="btn btn-danger" disabled={busy} onClick={remove}>امسحه نهائيًا</button>
        <Link className="btn btn-ghost" to="/dashboard">رجوع للوحة التحكم</Link>
      </div>
    </div></div>
  )
}

import { useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { supabase, IMAGES_BUCKET, imageUrl } from '../lib/supabase'
import type { ListingImage } from '../lib/types'
import { track } from '../lib/analytics'
import { humanizeError } from '../lib/format'

const SLOT_LABELS = ['من الأمام', 'من الجنب', 'تفاصيل قريبة', 'صورة إضافية', 'صورة إضافية', 'صورة إضافية', 'صورة إضافية', 'صورة إضافية']
const ANGLES: ListingImage['angle'][] = ['front', 'side', 'detail', 'other', 'other', 'other', 'other', 'other']
export const MIN_IMAGES = 3
export const MAX_IMAGES = 8

interface Props {
  listingId: string
  userId: string
  images: ListingImage[]
  onChange: (images: ListingImage[]) => void
  listingPublished: boolean
}

export default function ImageUploader({ listingId, userId, images, onChange, listingPublished }: Props) {
  const [progress, setProgress] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const inputs = useRef<Record<number, HTMLInputElement | null>>({})

  const sorted = [...images].sort((a, b) => a.position - b.position)

  async function upload(slot: number, file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('الملف ده مش صورة')
      track('listing_image_upload_failed', { reason: 'not_image', slot })
      return
    }
    const started = Date.now()
    try {
      setProgress((p) => ({ ...p, [slot]: 'بنضغط الصورة…' }))
      const compressed = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true, fileType: 'image/jpeg' })
      setProgress((p) => ({ ...p, [slot]: 'بنرفع…' }))
      const path = `${userId}/${listingId}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage.from(IMAGES_BUCKET).upload(path, compressed, { contentType: 'image/jpeg', cacheControl: '31536000' })
      if (upErr) throw upErr
      const position = sorted.length
      const { data, error: dbErr } = await supabase
        .from('listing_images')
        .insert({ listing_id: listingId, storage_path: path, position, angle: ANGLES[position] ?? 'other' })
        .select()
        .single()
      if (dbErr) throw dbErr
      onChange([...images, data as ListingImage])
      track('listing_image_uploaded', { listing_id: listingId, image_number: position + 1, size_kb: Math.round(compressed.size / 1024), seconds: Math.round((Date.now() - started) / 1000) })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(humanizeError(msg))
      track('listing_image_upload_failed', { listing_id: listingId, reason: msg.slice(0, 80), slot })
    } finally {
      setProgress((p) => { const n = { ...p }; delete n[slot]; return n })
    }
  }

  async function remove(img: ListingImage) {
    setError(null)
    const { error: dbErr } = await supabase.from('listing_images').delete().eq('id', img.id)
    if (dbErr) { setError(humanizeError(dbErr.message)); return }
    await supabase.storage.from(IMAGES_BUCKET).remove([img.storage_path])
    const remaining = images.filter((i) => i.id !== img.id).sort((a, b) => a.position - b.position)
    // re-number positions so slots stay contiguous
    await Promise.all(remaining.map((i, idx) => i.position !== idx ? supabase.from('listing_images').update({ position: idx }).eq('id', i.id) : null))
    onChange(remaining.map((i, idx) => ({ ...i, position: idx })))
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="uploader">
        {Array.from({ length: MAX_IMAGES }).map((_, slot) => {
          const img = sorted[slot]
          const busy = progress[slot]
          const canAdd = slot === sorted.length && !busy
          return (
            <div key={slot} className={`slot ${img ? 'has' : ''}`}>
              {img ? (
                <>
                  <img src={imageUrl(img.storage_path)} alt={SLOT_LABELS[slot]} />
                  <span className="label">{SLOT_LABELS[slot]}</span>
                  <button type="button" className="del" onClick={() => remove(img)} aria-label="مسح الصورة" disabled={listingPublished && sorted.length <= MIN_IMAGES}>×</button>
                </>
              ) : canAdd ? (
                <>
                  <div style={{ fontSize: 26 }}>＋</div>
                  <div><b>{SLOT_LABELS[slot]}</b>{slot < MIN_IMAGES && <div style={{ fontSize: 11, color: 'var(--accent)' }}>مطلوبة</div>}</div>
                  <input
                    ref={(el) => { inputs.current[slot] = el }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(slot, f); e.target.value = '' }}
                  />
                </>
              ) : (
                <div style={{ opacity: .5 }}>{SLOT_LABELS[slot]}</div>
              )}
              {busy && <div className="prog">{busy}</div>}
            </div>
          )
        })}
      </div>
      <p className="meta" style={{ marginTop: 8 }}>
        {sorted.length} من {MAX_IMAGES} صور · المطلوب {MIN_IMAGES} على الأقل من زوايا مختلفة. الصور بتتصغّر تلقائيًا عشان ترفع بسرعة.
      </p>
    </div>
  )
}

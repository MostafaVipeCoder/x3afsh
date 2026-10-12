import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_KEY are missing from .env')
}

export const supabase = createClient(url, key)

export const IMAGES_BUCKET = 'listing-images'

export function imageUrl(storagePath: string): string {
  if (/^https?:\/\//.test(storagePath)) return storagePath // demo/seed rows may point at an external image
  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

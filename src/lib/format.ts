const nf = new Intl.NumberFormat('en-US')

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—'
  return `${nf.format(Math.round(price))} ج`
}

/** Normalizes an Egyptian mobile number to E.164 (+2010xxxxxxxx). Returns null if not valid. */
export function normalizeEgyptPhone(input: string): string | null {
  const d = input.replace(/\D/g, '')
  if (/^01[0125][0-9]{8}$/.test(d)) return `+20${d.slice(1)}`
  if (/^201[0125][0-9]{8}$/.test(d)) return `+${d}`
  if (/^1[0125][0-9]{8}$/.test(d)) return `+20${d}`
  return null
}

/** Count characters excluding whitespace (rules B2 / C3). */
export function countNonSpace(text: string): number {
  return text.replace(/\s/g, '').length
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 3600) return `من ${Math.max(1, Math.floor(diff / 60))} دقيقة`
  if (diff < 86400) return `من ${Math.floor(diff / 3600)} ساعة`
  const days = Math.floor(diff / 86400)
  if (days === 1) return 'من يوم'
  if (days < 30) return `من ${days} يوم`
  return `من ${Math.floor(days / 30)} شهر`
}

/** Maps database error messages to Arabic the user can act on. */
export function humanizeError(message: string): string {
  if (message.startsWith('LISTING_INCOMPLETE:')) {
    const map: Record<string, string> = {
      title: 'العنوان',
      description: 'الوصف (30 حرف على الأقل)',
      price: 'السعر',
      category: 'التصنيف',
      governorate: 'المحافظة',
      images: '3 صور على الأقل',
      phone: 'رقم موبايل في حسابك (من صفحة حسابي)',
    }
    const parts = message.split(':')[1].split(',').map((k) => map[k] ?? k)
    return `الطقم ناقصه: ${parts.join('، ')}`
  }
  const known: Record<string, string> = {
    IMAGES_MAX_8: 'أقصى عدد صور 8',
    IMAGES_MIN_3_WHILE_PUBLISHED: 'الطقم المعروض لازم يفضل فيه 3 صور على الأقل. اخفيه الأول لو عايز تمسح.',
    SELLER_CANNOT_RATE_OWN_LISTING: 'مينفعش تقيّم طقمك',
    OPENING_PRICE_MUST_BE_BELOW_LISTED: 'السعر المقترح لازم يكون أقل من السعر المعروض',
    NOT_YOUR_TURN: 'مستني رد الطرف التاني',
    MAX_10_ROUNDS: 'التفاوض وصل لأقصى عدد ردود (10)',
    BLOCKED: 'مش متاح التواصل مع المستخدم ده',
  }
  for (const k of Object.keys(known)) if (message.includes(k)) return known[k]
  if (message.includes('review_rating_needs_15_chars')) return 'اكتب تعليق 15 حرف على الأقل عشان تقدر تقيّم'
  if (message.includes('Failed to fetch')) return 'مفيش اتصال بالإنترنت'
  return message
}

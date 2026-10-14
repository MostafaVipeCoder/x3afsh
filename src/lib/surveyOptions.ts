// Option lists for the surveys (docs/02 section ز). Slugs are what gets stored; labels are what users see.
export const NOT_BOUGHT_REASONS: [string, string][] = [
  ['no_reply', 'البايع مردش'],
  ['late_reply', 'البايع رد متأخر'],
  ['price', 'السعر مش مناسب واتفقناش'],
  ['worse_condition', 'الحالة أسوأ من الصور'],
  ['different_specs', 'المواصفات مختلفة عن الوصف'],
  ['sold_to_other', 'اتباع لحد تاني قبلي'],
  ['far_no_transport', 'بعيد عني ومفيش نقل'],
  ['changed_mind', 'غيّرت رأيي'],
  ['seller_rude', 'البايع مش محترم'],
  ['other', 'غير ذلك'],
]

export const USEFUL_REASONS: [string, string][] = [
  ['clear_photos', 'الصور واضحة'],
  ['clear_price', 'السعر واضح'],
  ['negotiation', 'التفاوض'],
  ['chat', 'المحادثة'],
  ['reviews', 'التقييمات'],
  ['easy_contact', 'سهولة التواصل'],
  ['found_fast', 'لقيت اللي عايزه بسرعة'],
  ['other', 'غير ذلك'],
]

export const IMPROVEMENT_OPTIONS: [string, string][] = [
  ['few_listings', 'أطقم قليلة'],
  ['sellers_no_reply', 'البايعين مش بيردوا'],
  ['search_hard', 'البحث صعب'],
  ['photos_not_enough', 'الصور مش كفاية'],
  ['other', 'غير ذلك'],
]

export const EXTRA_COST_TYPES: [string, string][] = [
  ['transport', 'نقل'],
  ['assembly', 'فك وتركيب'],
  ['other', 'غير ذلك'],
]

export const CSAT_TRIGGER_LABEL: Record<string, string> = {
  returning_seller: 'بايع حد تواصل معاه',
  returning_buyer: 'مشتري تواصل مع بايع',
  returning_no_contact: 'بايع محدش تواصل معاه (أسبوع)',
  // old triggers (before 14 Oct): asked right after an action
  listing_published: 'بعد نشر طقم (قديم)',
  negotiation_ended: 'بعد انتهاء تفاوض (قديم)',
  first_conversation: 'بعد أول محادثة (قديم)',
}

export function label(list: [string, string][], slug: string): string {
  return list.find(([s]) => s === slug)?.[1] ?? slug
}

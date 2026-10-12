export type ListingStatus = 'draft' | 'published' | 'sold' | 'hidden'

export interface Category { id: number; slug: string; name_ar: string; sort_order: number }
export interface Governorate { id: number; slug: string; name_ar: string }

export interface Profile {
  id: string
  display_name: string
  phone: string | null
  governorate_id: number | null
  is_owner: boolean
}

export interface ListingImage {
  id: string
  listing_id: string
  storage_path: string
  position: number
  angle: 'front' | 'side' | 'detail' | 'other'
}

export interface Listing {
  id: string
  seller_id: string
  title: string
  description: string
  price: number | null
  category_id: number | null
  governorate_id: number | null
  status: ListingStatus
  published_at: string | null
  sold_at: string | null
  created_at: string
  listing_images?: ListingImage[]
  categories?: { name_ar: string } | null
  governorates?: { name_ar: string } | null
}

export const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'مسودة',
  published: 'معروض',
  sold: 'اتباع',
  hidden: 'مخفي',
}

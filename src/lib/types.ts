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
  rating?: RatingStats | null
}

export interface RatingStats { listing_id: string; avg_rating: number | null; rating_count: number; comment_count: number }

export interface Review {
  id: string
  listing_id: string
  author_id: string | null
  parent_id: string | null
  rating: number | null
  body: string
  created_at: string
  author?: { display_name: string } | null
}

export type NegotiationStatus = 'open' | 'agreed' | 'rejected' | 'expired' | 'closed'
export type OfferType = 'offer' | 'counter' | 'accept' | 'reject'

export interface Negotiation {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  status: NegotiationStatus
  listed_price: number
  opening_price: number
  final_price: number | null
  round_count: number
  last_offer_by: string | null
  last_offer_at: string
  expires_at: string
  closed_at: string | null
  created_at: string
  // from my_negotiations view
  listing_title?: string
  listing_image?: string | null
  other_id?: string
  other_name?: string | null
  my_turn?: boolean
}

export interface Offer { id: string; negotiation_id: string; by_user_id: string; type: OfferType; price: number | null; created_at: string }

export interface ConversationSummary {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  last_message_at: string | null
  created_at: string
  listing_title: string
  listing_status: ListingStatus
  listing_image: string | null
  other_id: string
  other_name: string | null
  last_message: string | null
  unread_count: number
}

export interface Message { id: string; conversation_id: string; sender_id: string; body: string; read_at: string | null; created_at: string }

export type NotificationType = 'new_message' | 'new_offer' | 'offer_reply' | 'negotiation_ended' | 'new_review' | 'buyer_reported_purchase' | 'listing_reminder' | 'listing_flagged'
export interface Notification { id: string; user_id: string; type: NotificationType; payload: Record<string, unknown>; read_at: string | null; created_at: string }

export const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'مسودة',
  published: 'معروض',
  sold: 'اتباع',
  hidden: 'مخفي',
}

export const NEGOTIATION_LABEL: Record<NegotiationStatus, string> = {
  open: 'مفتوح',
  agreed: 'اتفاق',
  rejected: 'مرفوض',
  expired: 'انتهى بالصمت',
  closed: 'اتقفل',
}

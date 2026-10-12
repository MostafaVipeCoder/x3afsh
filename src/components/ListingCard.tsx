import { Link } from 'react-router-dom'
import type { Listing } from '../lib/types'
import { imageUrl } from '../lib/supabase'
import { formatPrice, timeAgo } from '../lib/format'
import { track } from '../lib/analytics'

export default function ListingCard({ listing, source }: { listing: Listing; source: string }) {
  const first = [...(listing.listing_images ?? [])].sort((a, b) => a.position - b.position)[0]
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="lcard"
      onClick={() => track('listing_opened', { listing_id: listing.id, source, price: listing.price, category_id: listing.category_id })}
    >
      <div className="img">
        {first ? <img src={imageUrl(first.storage_path)} alt={listing.title} loading="lazy" /> : <span>بدون صورة</span>}
        {listing.status === 'sold' && <span className="badge">اتباع</span>}
      </div>
      <div className="c">
        <p className="t">{listing.title}</p>
        <p className="p">{formatPrice(listing.price)}</p>
        {listing.rating && listing.rating.rating_count > 0 && (
          <p className="m" style={{ color: '#b8860b' }}>★ {listing.rating.avg_rating} <span style={{ color: 'var(--muted)' }}>({listing.rating.rating_count})</span></p>
        )}
        <p className="m">
          {listing.categories?.name_ar}{listing.categories && listing.governorates ? ' · ' : ''}{listing.governorates?.name_ar}
          {listing.published_at ? ` · ${timeAgo(listing.published_at)}` : ''}
        </p>
      </div>
    </Link>
  )
}

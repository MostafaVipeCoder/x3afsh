import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import type { Listing } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { pageView } from '../lib/analytics'

export default function Favorites() {
  const { session } = useAuth()
  const { ids, loaded } = useFavorites()
  const navigate = useNavigate()
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) { navigate('/login?next=/favorites'); return }
    pageView('favorites')
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaded) return
    const list = [...ids]
    if (list.length === 0) { setItems([]); setLoading(false); return }
    supabase.from('listings')
      .select('id, seller_id, title, price, category_id, governorate_id, status, published_at, created_at, description, sold_at, listing_images(id, listing_id, storage_path, position, angle), categories(name_ar), governorates(name_ar)')
      .in('id', list)
      .then(({ data }) => { setItems((data as unknown as Listing[]) ?? []); setLoading(false) })
  }, [ids, loaded])

  if (!session) return null
  return (
    <div className="container">
      <h1>المفضلة</h1>
      {loading ? <div className="spinner" /> : items.length === 0 ? (
        <div className="empty"><div className="big">♡</div><h2>لسه محفظتش حاجة</h2><p>اضغط على القلب في أي طقم عشان ترجعله بعدين.</p><Link className="btn btn-primary" to="/">تصفح الأطقم</Link></div>
      ) : (
        <div className="grid">{items.map((l) => <ListingCard key={l.id} listing={l} source="favorites" />)}</div>
      )}
    </div>
  )
}

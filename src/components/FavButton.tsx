import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'

export default function FavButton({ listingId, size = 'sm' }: { listingId: string; size?: 'sm' | 'lg' }) {
  const { session, profile } = useAuth()
  const { ids, toggle } = useFavorites()
  const navigate = useNavigate()
  const on = ids.has(listingId)
  if (profile?.is_owner) return null
  return (
    <button
      type="button"
      className={`fav ${on ? 'on' : ''} ${size}`}
      aria-label={on ? 'شيل من المفضلة' : 'احفظ في المفضلة'}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation()
        if (!session) { navigate(`/login?next=/listing/${listingId}`); return }
        toggle(listingId)
      }}
    >
      {on ? '♥' : '♡'}{size === 'lg' && <span>{on ? ' في المفضلة' : ' احفظ'}</span>}
    </button>
  )
}

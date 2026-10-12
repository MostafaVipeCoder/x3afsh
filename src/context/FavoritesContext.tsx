import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { track } from '../lib/analytics'

interface FavState {
  ids: Set<string>
  toggle: (listingId: string) => Promise<void>
  loaded: boolean
}

const Ctx = createContext<FavState>({ ids: new Set(), toggle: async () => {}, loaded: false })

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!session) { setIds(new Set()); setLoaded(false); return }
    supabase.from('favorites').select('listing_id').then(({ data }) => {
      setIds(new Set(((data as { listing_id: string }[]) ?? []).map((f) => f.listing_id)))
      setLoaded(true)
    })
  }, [session])

  const toggle = useCallback(async (listingId: string) => {
    if (!session) return
    const has = ids.has(listingId)
    setIds((prev) => { const n = new Set(prev); if (has) n.delete(listingId); else n.add(listingId); return n })
    if (has) {
      await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('listing_id', listingId)
      track('favorite_removed', { listing_id: listingId })
    } else {
      await supabase.from('favorites').insert({ user_id: session.user.id, listing_id: listingId })
      track('favorite_added', { listing_id: listingId })
    }
  }, [session, ids])

  return <Ctx.Provider value={{ ids, toggle, loaded }}>{children}</Ctx.Provider>
}

export function useFavorites() {
  return useContext(Ctx)
}

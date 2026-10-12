import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Category, Governorate } from '../lib/types'

interface RefData {
  categories: Category[]
  governorates: Governorate[]
}

const RefDataContext = createContext<RefData>({ categories: [], governorates: [] })

export function RefDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<RefData>({ categories: [], governorates: [] })

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('governorates').select('*').order('id'),
    ]).then(([c, g]) => {
      setData({ categories: (c.data as Category[]) ?? [], governorates: (g.data as Governorate[]) ?? [] })
    })
  }, [])

  return <RefDataContext.Provider value={data}>{children}</RefDataContext.Provider>
}

export function useRefData() {
  return useContext(RefDataContext)
}

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRefData } from '../context/RefDataContext'
import { useAuth } from '../context/AuthContext'
import type { Listing, RatingStats } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { track, pageView } from '../lib/analytics'

const PAGE = 24

export default function Home() {
  const { categories, governorates } = useRefData()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const cat = params.get('cat') ?? ''
  const gov = params.get('gov') ?? ''
  const max = params.get('max') ?? ''
  const [search, setSearch] = useState(q)
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounce = useRef<number | undefined>(undefined)
  const { session } = useAuth()
  // docs/04 section 6: after 3 searches without opening a listing → "عرفت تلاقي اللي بتدور عليه؟" (once per visit)
  const [askSearch, setAskSearch] = useState(false)
  const [searchAnswered, setSearchAnswered] = useState(false)

  function noteSearch(query: string, resultCount: number) {
    try {
      if (sessionStorage.getItem('x3afsh_search_fb') === '1') return
      const n = Number(sessionStorage.getItem('x3afsh_searches') || 0) + 1
      sessionStorage.setItem('x3afsh_searches', String(n))
      if (n >= 3 || resultCount === 0) { setAskSearch(true); track('search_feedback_shown', { searches: n, last_query: query, result_count: resultCount }) }
    } catch { /* storage may be unavailable */ }
  }

  async function answerSearch(found: boolean) {
    try { sessionStorage.setItem('x3afsh_search_fb', '1') } catch { /* ignore */ }
    track('search_feedback_answered', { found, query: q })
    if (session) await supabase.from('micro_surveys').insert({ user_id: session.user.id, kind: 'search_feedback', choices: [found ? 'found' : 'not_found'], free_text: q.trim() || null })
    setSearchAnswered(true)
    setTimeout(() => setAskSearch(false), 2500)
  }

  function setFilter(key: string, value: string) {
    const n = new URLSearchParams(params)
    if (value) n.set(key, value); else n.delete(key)
    setParams(n, { replace: true })
    if (key !== 'q') track('filter_used', { filter: key, value })
  }

  useEffect(() => { pageView('home') }, [])

  useEffect(() => {
    setSearch(q)
  }, [q])

  async function load(offset = 0) {
    setLoading(true); setError(null)
    let query = supabase
      .from('listings')
      .select('id, seller_id, title, price, category_id, governorate_id, status, published_at, created_at, description, sold_at, listing_images(id, listing_id, storage_path, position, angle), categories(name_ar), governorates(name_ar)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (cat) query = query.eq('category_id', Number(cat))
    if (gov) query = query.eq('governorate_id', Number(gov))
    if (max) query = query.lte('price', Number(max))
    if (q.trim()) query = query.or(`title.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`)
    const { data, error: err } = await query
    setLoading(false)
    if (err) { setError('حصلت مشكلة في تحميل الأطقم. جرّب تاني.'); return }
    const rows = (data as unknown as Listing[]) ?? []
    if (rows.length) {
      const { data: s } = await supabase.from('listing_rating_stats').select('*').in('listing_id', rows.map((r) => r.id))
      const byId = new Map((s as RatingStats[] | null ?? []).map((x) => [x.listing_id, x]))
      rows.forEach((r) => { r.rating = byId.get(r.id) ?? null })
    }
    setItems((prev) => offset === 0 ? rows : [...prev, ...rows])
    setHasMore(rows.length === PAGE)
    if (offset === 0) {
      if (q.trim()) { track('search_performed', { query: q.trim(), result_count: rows.length }); noteSearch(q.trim(), rows.length) }
      else track('listings_viewed', { category_id: cat || null, governorate_id: gov || null, max_price: max || null, result_count: rows.length })
    }
  }

  useEffect(() => { load(0) }, [q, cat, gov, max]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="container">
      <div className="filters">
        <input
          className="input search"
          type="search"
          placeholder="دوّر على غرفة نوم، سفرة، ركنة…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            window.clearTimeout(debounce.current)
            debounce.current = window.setTimeout(() => setFilter('q', e.target.value), 450)
          }}
        />
        <select className="input" value={cat} onChange={(e) => setFilter('cat', e.target.value)} aria-label="التصنيف">
          <option value="">كل التصنيفات</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
        </select>
        <select className="input" value={gov} onChange={(e) => setFilter('gov', e.target.value)} aria-label="المحافظة">
          <option value="">كل المحافظات</option>
          {governorates.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
        </select>
        <select className="input" value={max} onChange={(e) => setFilter('max', e.target.value)} aria-label="أقصى سعر">
          <option value="">أي سعر</option>
          <option value="3000">لحد 3,000 ج</option>
          <option value="7000">لحد 7,000 ج</option>
          <option value="15000">لحد 15,000 ج</option>
          <option value="30000">لحد 30,000 ج</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {askSearch && (
        <div className="search-feedback" role="status">
          {searchAnswered ? <b>شكرًا! 🙏</b> : (
            <>
              <b>عرفت تلاقي اللي بتدور عليه؟</b>
              <button className="btn btn-primary btn-sm" onClick={() => answerSearch(true)}>أيوه</button>
              <button className="btn btn-outline btn-sm" onClick={() => answerSearch(false)}>لأ</button>
            </>
          )}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="big">🛋️</div>
          <h2>{q ? 'ملقيناش حاجة بالاسم ده' : 'لسه مفيش أطقم هنا'}</h2>
          <p>{q ? 'جرّب كلمة تانية أو شيل الفلاتر.' : 'كن أول واحد يعرض طقم!'}</p>
          {(q || cat || gov || max) && <button className="btn btn-outline" onClick={() => setParams({}, { replace: true })}>شيل الفلاتر</button>}
        </div>
      ) : (
        <>
          <div className="grid">
            {items.map((l) => <ListingCard key={l.id} listing={l} source={q ? 'search' : 'browse'} />)}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <button className="btn btn-outline" disabled={loading} onClick={() => load(items.length)}>{loading ? 'بنحمّل…' : 'اعرض أكتر'}</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

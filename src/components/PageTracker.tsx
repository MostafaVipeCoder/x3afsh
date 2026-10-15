import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Records page views and visible time on page for the owner dashboard (docs/03 — الزيارات).
 * - visitor: one browser (localStorage), session: one visit (new after 30 min idle)
 * - time counts only while the tab is visible; sent every 15 s, on page change and when the tab is hidden
 * - the platform owner is never tracked; disabled in local development unless ?track=1
 */

const VISITOR_KEY = 'x3afsh_vid'
const SESSION_KEY = 'x3afsh_sid'
const SESSION_AT_KEY = 'x3afsh_sid_at'
const IDLE_MS = 30 * 60 * 1000
const BEAT_MS = 15_000

function uuid(): string {
  return crypto.randomUUID()
}

function store(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value)
    return localStorage.getItem(key)
  } catch { return value ?? null }
}

function visitorId(): string {
  return store(VISITOR_KEY) ?? store(VISITOR_KEY, uuid())!
}

function sessionId(): string {
  const now = Date.now()
  const last = Number(store(SESSION_AT_KEY) || 0)
  let sid = store(SESSION_KEY)
  if (!sid || now - last > IDLE_MS) sid = store(SESSION_KEY, uuid())
  store(SESSION_AT_KEY, String(now))
  return sid!
}

function pageOf(path: string): { page: string; listing: string | null } {
  const m = path.match(/^\/listing\/([0-9a-f-]{36})/)
  if (m) return { page: 'listing', listing: m[1] }
  const first = path.split('/')[1] || 'home'
  const known = ['new', 'edit', 'my', 'inbox', 'chat', 'negotiation', 'favorites', 'account', 'login', 'terms', 'privacy']
  return { page: known.includes(first) ? first : 'home', listing: null }
}

const enabled = !import.meta.env.DEV || new URLSearchParams(window.location.search).has('track')
const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string
const KEY = import.meta.env.VITE_SUPABASE_KEY as string

export default function PageTracker() {
  const { loading, profile, session } = useAuth()
  const location = useLocation()
  const current = useRef<{ id: string | null; visitor: string; visibleMs: number; since: number | null } | null>(null)

  // send the visible time; keepalive lets it finish even if the tab is closing
  function flush(final = false) {
    const c = current.current
    if (!c || !c.id) return
    const ms = c.visibleMs + (c.since ? Date.now() - c.since : 0)
    const body = JSON.stringify({ p_id: c.id, p_visitor: c.visitor, p_ms: Math.round(ms) })
    const token = session?.access_token ?? KEY
    fetch(`${URL_BASE}/rest/v1/rpc/touch_page_view`, {
      method: 'POST',
      keepalive: final,
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${token}` },
      body,
    }).catch(() => { /* best effort */ })
  }

  // a new page view on every route change
  useEffect(() => {
    if (!enabled || loading || profile?.is_owner) return
    flush(true)
    const { page, listing } = pageOf(location.pathname)
    const visitor = visitorId()
    const entry = { id: null as string | null, visitor, visibleMs: 0, since: document.visibilityState === 'visible' ? Date.now() : null }
    current.current = entry
    supabase.rpc('start_page_view', {
      p_visitor: visitor,
      p_session: sessionId(),
      p_page: page,
      p_listing: listing,
      p_device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      p_referrer: document.referrer ? new URL(document.referrer).hostname : null,
    }).then(({ data }) => { if (current.current === entry) entry.id = (data as string | null) ?? null })
  }, [location.pathname, loading, profile?.is_owner]) // eslint-disable-line react-hooks/exhaustive-deps

  // count only visible time; heartbeat while visible
  useEffect(() => {
    if (!enabled) return
    function onVis() {
      const c = current.current
      if (!c) return
      if (document.visibilityState === 'hidden') {
        if (c.since) { c.visibleMs += Date.now() - c.since; c.since = null }
        flush(true)
      } else {
        c.since = Date.now()
        store(SESSION_AT_KEY, String(Date.now()))
      }
    }
    const beat = window.setInterval(() => {
      if (document.visibilityState === 'visible') { flush(); store(SESSION_AT_KEY, String(Date.now())) }
    }, BEAT_MS)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', () => flush(true))
    return () => { window.clearInterval(beat); document.removeEventListener('visibilitychange', onVis) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

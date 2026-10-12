import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Notification } from '../lib/types'
import { formatPrice, timeAgo } from '../lib/format'
import { track } from '../lib/analytics'

export function describe(n: Notification): { text: string; to: string } {
  const p = n.payload as Record<string, string | number | boolean | undefined>
  switch (n.type) {
    case 'new_message': return { text: 'رسالة جديدة', to: `/chat/${p.conversation_id}` }
    case 'new_offer': return { text: `عرض سعر جديد: ${formatPrice(Number(p.price))}`, to: `/negotiation/${p.negotiation_id}` }
    case 'offer_reply': return { text: `عرض مضاد: ${formatPrice(Number(p.price))}`, to: `/negotiation/${p.negotiation_id}` }
    case 'negotiation_ended': return { text: p.result === 'agreed' ? `اتفاق على ${formatPrice(Number(p.price))} 🎉` : 'الطرف التاني رفض التفاوض', to: `/negotiation/${p.negotiation_id}` }
    case 'new_review': return { text: p.reply ? 'رد على تعليقك' : p.rating ? 'تقييم جديد على طقمك' : 'تعليق جديد على طقمك', to: `/listing/${p.listing_id}` }
    case 'buyer_reported_purchase': return { text: 'المشتري قال إنه اشترى الطقم. تعلّمه كمباع؟', to: '/my' }
    case 'listing_reminder': return { text: 'لسه الطقم ده موجود؟ حدّثه أو علّمه كمباع', to: '/my' }
    case 'listing_flagged': return { text: 'طقمك اتخفى بعد بلاغات وجاري مراجعته', to: '/my' }
    default: return { text: 'إشعار', to: '/' }
  }
}

export default function NotificationBell() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  async function load() {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20)
    setItems((data as Notification[]) ?? [])
  }

  useEffect(() => {
    if (!session) { setItems([]); return }
    load()
    const ch = supabase.channel('notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, (payload) => {
        setItems((prev) => [payload.new as Notification, ...prev].slice(0, 20))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session])

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!session) return null
  const unread = items.filter((n) => !n.read_at).length

  async function openList() {
    setOpen((o) => !o)
    if (!open) track('notifications_opened', { unread })
  }

  async function go(n: Notification) {
    const { to } = describe(n)
    if (!n.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
    }
    track('notification_clicked', { type: n.type })
    setOpen(false)
    navigate(to)
  }

  async function markAll() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })))
  }

  return (
    <div className="bell-wrap" ref={box}>
      <button className="bell" onClick={openList} aria-label={`الإشعارات${unread ? `، ${unread} جديد` : ''}`}>
        🔔{unread > 0 && <span className="dot">{unread}</span>}
      </button>
      {open && (
        <div className="bell-menu card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
            <b>الإشعارات</b>
            {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}>علّم الكل كمقروء</button>}
          </div>
          {items.length === 0 ? <p className="meta" style={{ padding: 14, textAlign: 'center' }}>مفيش إشعارات</p> : items.map((n) => {
            const d = describe(n)
            return (
              <button key={n.id} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => go(n)}>
                <div>{d.text}</div>
                <div className="meta" style={{ fontSize: 12 }}>{timeAgo(n.created_at)}</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

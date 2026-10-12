import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, imageUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { ConversationSummary, Negotiation } from '../lib/types'
import { NEGOTIATION_LABEL } from '../lib/types'
import { formatPrice, timeAgo } from '../lib/format'
import { pageView } from '../lib/analytics'

export default function Inbox() {
  const { session } = useAuth()
  const me = session?.user.id
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'negotiations' ? 'negotiations' : 'chats'
  const [convs, setConvs] = useState<ConversationSummary[]>([])
  const [negs, setNegs] = useState<Negotiation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) { navigate('/login?next=/inbox'); return }
    pageView('inbox', { tab })
    Promise.all([
      supabase.from('my_conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false }),
      supabase.from('my_negotiations').select('*').order('last_offer_at', { ascending: false }),
    ]).then(([c, n]) => {
      setConvs((c.data as ConversationSummary[]) ?? [])
      setNegs((n.data as Negotiation[]) ?? [])
      setLoading(false)
    })
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null

  const openNegs = negs.filter((n) => n.status === 'open')
  const doneNegs = negs.filter((n) => n.status !== 'open')

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1>الوارد</h1>
      <div className="tabs">
        <button className={tab === 'chats' ? 'active' : ''} onClick={() => setParams({ tab: 'chats' })}>المحادثات {convs.reduce((s, c) => s + Number(c.unread_count), 0) > 0 && <span className="dot">{convs.reduce((s, c) => s + Number(c.unread_count), 0)}</span>}</button>
        <button className={tab === 'negotiations' ? 'active' : ''} onClick={() => setParams({ tab: 'negotiations' })}>التفاوضات {openNegs.filter((n) => n.my_turn).length > 0 && <span className="dot">{openNegs.filter((n) => n.my_turn).length}</span>}</button>
      </div>

      {loading ? <div className="spinner" /> : tab === 'chats' ? (
        convs.length === 0 ? <div className="empty"><div className="big">💬</div><h2>مفيش محادثات لسه</h2><p>افتح طقم ودوس "راسل البايع".</p></div> : (
          <div className="card">
            {convs.map((c) => (
              <Link key={c.id} to={`/chat/${c.id}`} className="list-row" style={{ color: 'var(--ink)' }}>
                {c.listing_image ? <img className="thumb" src={imageUrl(c.listing_image)} alt="" /> : <div className="thumb" />}
                <div className="grow">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <b>{c.other_name || 'مستخدم'}</b>
                    {Number(c.unread_count) > 0 && <span className="dot">{c.unread_count}</span>}
                    <span className="meta" style={{ marginInlineStart: 'auto' }}>{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
                  </div>
                  <div className="meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.listing_title} · {c.last_message || 'لسه مفيش رسايل'}</div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        negs.length === 0 ? <div className="empty"><div className="big">🤝</div><h2>مفيش تفاوضات لسه</h2><p>افتح طقم ودوس "فاوض على السعر".</p></div> : (
          <>
            {[...openNegs, ...doneNegs].map((n) => (
              <Link key={n.id} to={`/negotiation/${n.id}`} className="card list-row" style={{ color: 'var(--ink)', marginBottom: 8 }}>
                {n.listing_image ? <img className="thumb" src={imageUrl(n.listing_image)} alt="" /> : <div className="thumb" />}
                <div className="grow">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b>{n.listing_title}</b>
                    <span className={`pill ${n.status === 'open' ? 'pill-published' : n.status === 'agreed' ? 'pill-published' : 'pill-sold'}`}>{NEGOTIATION_LABEL[n.status]}</span>
                    {n.my_turn && <span className="dot">دورك</span>}
                  </div>
                  <div className="meta">
                    {n.buyer_id === me ? 'البايع' : 'المشتري'}: {n.other_name || '—'} · معروض {formatPrice(n.listed_price)} · {n.status === 'agreed' ? `اتفاق ${formatPrice(n.final_price)}` : `بدأ بـ${formatPrice(n.opening_price)}`} · {timeAgo(n.last_offer_at)}
                  </div>
                </div>
              </Link>
            ))}
          </>
        )
      )}
    </div>
  )
}

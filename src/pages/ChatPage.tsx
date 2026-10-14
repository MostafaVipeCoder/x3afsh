import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, imageUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { ConversationSummary, Message, Profile } from '../lib/types'
import { humanizeError } from '../lib/format'
import { track, pageView } from '../lib/analytics'

export default function ChatPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const me = session?.user.id
  const [conv, setConv] = useState<ConversationSummary | null>(null)
  const [other, setOther] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const bottom = useRef<HTMLDivElement>(null)

  async function load() {
    const { data: c } = await supabase.from('my_conversations').select('*').eq('id', id!).maybeSingle()
    const conv = c as ConversationSummary | null
    setConv(conv)
    if (conv) {
      const [{ data: m }, { data: p }, { data: b }] = await Promise.all([
        supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at'),
        supabase.from('profiles').select('*').eq('id', conv.other_id).maybeSingle(),
        supabase.from('blocks').select('blocked_id').eq('blocker_id', me!).eq('blocked_id', conv.other_id).maybeSingle(),
      ])
      setMessages((m as Message[]) ?? [])
      setOther((p as Profile | null) ?? null)
      setBlocked(!!b)
      await supabase.rpc('mark_conversation_read', { p_conversation: conv.id })
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!session) return
    pageView('chat', { conversation_id: id })
    load()
    const ch = supabase.channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        const m = payload.new as Message
        setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m])
        if (m.sender_id !== me) supabase.rpc('mark_conversation_read', { p_conversation: id! })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, session]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  if (!session) return <div className="container"><div className="alert alert-info">سجّل دخول عشان تشوف الرسايل.</div><Link className="btn btn-primary" to={`/login?next=/chat/${id}`}>دخول</Link></div>
  if (loading) return <div className="spinner" />
  if (!conv) return <div className="container"><div className="empty"><h2>المحادثة دي مش موجودة</h2></div></div>

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true); setError(null)
    const first = messages.length === 0
    const { data, error: err } = await supabase.from('messages').insert({ conversation_id: conv!.id, sender_id: me, body: text.trim() }).select().single()
    setBusy(false)
    if (err) { setError(err.message.includes('row-level security') ? 'مش متاح إرسال رسايل في المحادثة دي (حظر).' : humanizeError(err.message)); return }
    setMessages((prev) => prev.some((x) => x.id === (data as Message).id) ? prev : [...prev, data as Message])
    setText('')
    track('message_sent', { conversation_id: conv!.id, first_message: first, length: text.trim().length, role: conv!.buyer_id === me ? 'buyer' : 'seller' })
  }

  async function contact(channel: 'call' | 'whatsapp') {
    const phone = other?.phone ?? ''
    track(channel === 'call' ? 'contact_call_clicked' : 'contact_whatsapp_clicked', { listing_id: conv!.listing_id, source: 'conversation' })
    if (conv!.buyer_id === me) await supabase.from('contact_clicks').insert({ user_id: me, listing_id: conv!.listing_id, channel, source: 'conversation' })
    window.location.href = channel === 'call' ? `tel:${phone}` : `https://wa.me/${phone.replace(/\D/g, '')}`
  }

  async function toggleBlock() {
    if (blocked) {
      await supabase.from('blocks').delete().eq('blocker_id', me!).eq('blocked_id', conv!.other_id)
      setBlocked(false); track('user_unblocked')
    } else {
      if (!window.confirm(`تحظر ${conv!.other_name || 'المستخدم ده'}؟ مش هيقدر يبعتلك رسايل أو يفاوضك.`)) return
      await supabase.from('blocks').insert({ blocker_id: me, blocked_id: conv!.other_id })
      setBlocked(true); track('user_blocked', { conversation_id: conv!.id })
    }
  }

  return (
    <div className="container chat-wrap">
      <div className="chat-head card">
        {conv.listing_image && <img src={imageUrl(conv.listing_image)} alt="" />}
        <div className="grow">
          <b>{conv.other_name || 'مستخدم'}</b>
          <div className="meta"><Link to={`/listing/${conv.listing_id}`}>{conv.listing_title}</Link></div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-whatsapp btn-sm" onClick={() => contact('whatsapp')} disabled={!other?.phone}>واتساب</button>
          <button className="btn btn-outline btn-sm" onClick={() => contact('call')} disabled={!other?.phone}>اتصل</button>
          <button className="btn btn-ghost btn-sm" onClick={toggleBlock} title={blocked ? 'فك الحظر' : 'حظر'}>{blocked ? 'فك الحظر' : '⛔'}</button>
        </div>
      </div>

      <div className="chat-body">
        {messages.length === 0 && <p className="meta" style={{ textAlign: 'center' }}>ابدأ المحادثة. اسأل عن الحالة أو المقاس أو ميعاد المعاينة.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.sender_id === me ? 'mine' : ''}`}>
            {m.body}
            <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>{new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }).format(new Date(m.created_at))}{m.sender_id === me && m.read_at ? ' · اتقرت' : ''}</div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {blocked ? (
        <div className="alert alert-info">أنت حاظر المستخدم ده. <button className="btn btn-ghost btn-sm" onClick={toggleBlock}>فك الحظر</button></div>
      ) : (
        <form className="chat-input" onSubmit={send}>
          <input className="input" placeholder="اكتب رسالة…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !text.trim()}>ابعت</button>
        </form>
      )}
    </div>
  )
}

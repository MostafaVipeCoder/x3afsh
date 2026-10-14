import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRefData } from '../context/RefDataContext'
import { track } from '../lib/analytics'
import { normalizeEgyptPhone } from '../lib/format'

export default function Account() {
  const { session, profile, refreshProfile, loading } = useAuth()
  const { governorates } = useRefData()
  const [params] = useSearchParams()
  const first = params.get('first') === '1'
  const next = params.get('next') || '/'
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [gov, setGov] = useState<string>('')
  const [phoneInput, setPhoneInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.display_name)
      setGov(profile.governorate_id ? String(profile.governorate_id) : '')
      setPhoneInput(profile.phone ? profile.phone.replace(/^\+20/, '0') : '')
    }
  }, [profile])

  useEffect(() => { if (!loading && !session) navigate('/login?next=/account') }, [loading, session, navigate])
  if (!session || !profile) return <div className="spinner" />

  const canEditPhone = !profile.phone_verified

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null); setMsg(null)
    if (name.trim().length < 2) { setError('اكتب اسمك عشان الناس تعرف بتكلم مين'); return }
    const patch: Record<string, unknown> = { display_name: name.trim(), governorate_id: gov ? Number(gov) : null }
    if (canEditPhone) {
      if (!phoneInput.trim()) { setError('محتاجين رقم موبايل عشان المشترين يقدروا يتصلوا بيك أو يبعتولك واتساب'); return }
      const normalized = normalizeEgyptPhone(phoneInput)
      if (!normalized) { setError('اكتب رقم موبايل مصري صحيح، مثلًا 01012345678'); return }
      patch.phone = normalized
    }
    setBusy(true)
    const { error: err } = await supabase.from('profiles').update(patch).eq('id', session!.user.id)
    setBusy(false)
    if (err) { setError(err.message.includes('profiles_phone_key') ? 'الرقم ده مسجّل بحساب تاني على المنصة. لو ده رقمك فعلًا، تواصل معانا.' : err.message); return }
    await refreshProfile()
    track('profile_updated', { first_time: first, has_governorate: !!gov, phone_added: canEditPhone && !!patch.phone })
    if (first) navigate(next, { replace: true })
    else setMsg('اتحفظ')
  }

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="card"><div className="card-body">
        <h1>{first ? 'أهلًا بيك! عرّفنا بنفسك' : 'حسابي'}</h1>
        {first && <p className="meta">اسمك ورقمك هيظهروا للناس اللي هتتواصل معاهم.</p>}
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="name">الاسم</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={first} />
          </div>
          <div className="field">
            <label htmlFor="gov">المحافظة</label>
            <select id="gov" className="input" value={gov} onChange={(e) => setGov(e.target.value)}>
              <option value="">اختار…</option>
              {governorates.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="phone">رقم الموبايل</label>
            <input id="phone" className="input" type="tel" inputMode="numeric" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} disabled={!canEditPhone} dir="ltr" style={{ textAlign: 'right' }} placeholder="01xxxxxxxxx" />
            <div className="hint">
              {profile.phone_verified
                ? '✓ رقم مؤكد. ده الرقم اللي الناس هتتصل عليه، ومش بيتغير من هنا.'
                : 'الناس هتتصل عليه وتبعتلك واتساب. اتأكد إنه صح.'}
            </div>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'بنحفظ…' : first ? 'يلا نبدأ' : 'حفظ'}</button>
        </form>
      </div></div>
    </div>
  )
}

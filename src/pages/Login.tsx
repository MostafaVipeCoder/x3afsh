import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { normalizeEgyptPhone } from '../lib/format'
import { track } from '../lib/analytics'

export default function Login() {
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const navigate = useNavigate()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)

  function startResendTimer() {
    setResendIn(60)
    const t = setInterval(() => setResendIn((s) => { if (s <= 1) { clearInterval(t); return 0 } return s - 1 }), 1000)
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    const normalized = normalizeEgyptPhone(phoneInput)
    if (!normalized) { setError('اكتب رقم موبايل مصري صحيح، مثلًا 01012345678'); return }
    setBusy(true)
    track('signup_started', { step: 'phone' })
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized })
    setBusy(false)
    if (err) {
      if (err.message.includes('Unsupported phone provider')) setError('إرسال الكود لسه مش متفعّل على المنصة (راجع دليل التشغيل — خطوة 1).')
      else if (err.message.toLowerCase().includes('rate')) setError('استنى شوية قبل ما تطلب كود تاني')
      else setError(`مقدرناش نبعت الكود: ${err.message}`)
      return
    }
    setPhone(normalized)
    setStep('otp')
    startResendTimer()
    track('otp_sent')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (code.replace(/\D/g, '').length < 6) { setError('الكود 6 أرقام'); return }
    setBusy(true)
    const { data, error: err } = await supabase.auth.verifyOtp({ phone, token: code.replace(/\D/g, ''), type: 'sms' })
    setBusy(false)
    if (err) { setError('الكود غلط أو انتهت صلاحيته'); return }
    track('phone_verified')
    track('logged_in')
    // First login: profile has no name yet → ask for it
    const { data: p } = await supabase.from('profiles').select('display_name').eq('id', data.user!.id).maybeSingle()
    if (!p?.display_name) navigate(`/account?first=1&next=${encodeURIComponent(next)}`, { replace: true })
    else navigate(next, { replace: true })
  }

  return (
    <div className="container" style={{ maxWidth: 440 }}>
      <div className="card"><div className="card-body">
        {step === 'phone' ? (
          <form onSubmit={sendCode}>
            <h1>دخول أو حساب جديد</h1>
            <p className="meta">هنبعتلك كود على الموبايل. مفيش كلمة سر.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="field">
              <label htmlFor="phone">رقم الموبايل</label>
              <input id="phone" className="input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="01xxxxxxxxx" dir="ltr" style={{ textAlign: 'right' }}
                value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'بنبعت…' : 'ابعت الكود'}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <h1>اكتب الكود</h1>
            <p className="meta">بعتنا كود من 6 أرقام على <bdi>{phone}</bdi>. <button type="button" className="btn-ghost" style={{ border: 0, padding: 0, color: 'var(--primary)', fontWeight: 700 }} onClick={() => { setStep('phone'); setCode('') }}>غيّر الرقم</button></p>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="field">
              <input className="input otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'بنتأكد…' : 'تأكيد'}</button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={resendIn > 0 || busy} onClick={() => sendCode()}>
                {resendIn > 0 ? `إعادة الإرسال بعد ${resendIn} ثانية` : 'ابعت الكود تاني'}
              </button>
            </div>
          </form>
        )}
      </div></div>
    </div>
  )
}

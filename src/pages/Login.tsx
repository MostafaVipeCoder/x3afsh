import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { normalizeEgyptPhone } from '../lib/format'
import { track } from '../lib/analytics'

const NEXT_KEY = 'x3afsh_next'

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
    track('signup_started', { step: 'phone', method: 'phone' })
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized })
    setBusy(false)
    if (err) {
      if (err.message.includes('Unsupported phone provider')) setError('إرسال الكود لسه مش متفعّل على المنصة. جرّب الدخول بجوجل تحت.')
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
    track('logged_in', { method: 'phone' })
    const { data: p } = await supabase.from('profiles').select('display_name').eq('id', data.user!.id).maybeSingle()
    if (!p?.display_name) navigate(`/account?first=1&next=${encodeURIComponent(next)}`, { replace: true })
    else navigate(next, { replace: true })
  }

  async function google() {
    setError(null); setBusy(true)
    track('signup_started', { step: 'oauth', method: 'google' })
    try { localStorage.setItem(NEXT_KEY, next) } catch { /* ignore */ }
    // Comes back to the site root with ?code=…; AuthContext finishes the sign-in and sends the user to `next`.
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } })
    if (err) { setBusy(false); setError(err.message.includes('not enabled') ? 'الدخول بجوجل لسه مش متفعّل على المنصة.' : err.message) }
  }

  // Development only: email + password accounts for local testing. Vite strips this block from production builds.
  const devMode = import.meta.env.DEV && params.get('dev') === '1'
  const [devEmail, setDevEmail] = useState('')
  const [devPass, setDevPass] = useState('')
  async function devLogin(e: FormEvent) {
    e.preventDefault(); setError(null); setBusy(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: devEmail, password: devPass })
    setBusy(false)
    if (err) { setError(err.message); return }
    navigate(next, { replace: true })
  }

  return (
    <div className="container" style={{ maxWidth: 440 }}>
      <div className="card"><div className="card-body">
        {devMode ? (
          <form onSubmit={devLogin}>
            <h1>دخول للتطوير</h1>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="field"><label>الإيميل</label><input className="input" type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} dir="ltr" /></div>
            <div className="field"><label>كلمة السر</label><input className="input" type="password" value={devPass} onChange={(e) => setDevPass(e.target.value)} dir="ltr" /></div>
            <button className="btn btn-primary btn-block" disabled={busy}>دخول</button>
          </form>
        ) : step === 'phone' ? (
          <>
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
            <div className="or"><span>أو</span></div>
            <button type="button" className="btn btn-outline btn-block btn-lg btn-google" disabled={busy} onClick={google}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4 7-10 7-17.5z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
              الدخول بحساب جوجل
            </button>
            <p className="meta" style={{ marginTop: 10, textAlign: 'center' }}>لو دخلت بجوجل، هنطلب منك رقم موبايل عشان الناس تقدر تتواصل معاك.</p>
          </>
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
      <p className="meta" style={{ textAlign: 'center', marginTop: 12 }}>بدخولك أنت موافق على <a href="#/terms">شروط الاستخدام</a> و<a href="#/privacy">سياسة الخصوصية</a>.</p>
    </div>
  )
}

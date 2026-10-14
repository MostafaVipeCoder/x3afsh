import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'

const NEXT_KEY = 'x3afsh_next'

/**
 * Sign-in is Google only (decision 3, revised 2026-10-14). Phone OTP was removed from the UI;
 * it can be restored from git history once an SMS provider is chosen (docs/11).
 */
export default function Login() {
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function google() {
    setError(null); setBusy(true)
    track('signup_started', { step: 'oauth', method: 'google' })
    try { localStorage.setItem(NEXT_KEY, next) } catch { /* ignore */ }
    // Comes back to the site root with ?code=…; AuthContext finishes the sign-in and sends the user to `next`.
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } })
    if (err) { setBusy(false); setError('مقدرناش نفتح تسجيل جوجل. جرّب تاني بعد شوية.') }
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
        ) : (
          <>
            <h1>دخول أو حساب جديد</h1>
            <p className="meta">ادخل بحساب جوجل بتاعك في ثانية. مفيش كلمة سر جديدة تفتكرها.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <button type="button" className="btn btn-outline btn-block btn-lg btn-google" disabled={busy} onClick={google}>
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4 7-10 7-17.5z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
              {busy ? 'بنفتح جوجل…' : 'الدخول بحساب جوجل'}
            </button>
            <p className="meta" style={{ marginTop: 12, textAlign: 'center' }}>أول مرة هنطلب منك اسمك ورقم موبايلك، عشان الناس تقدر تتصل بيك أو تبعتلك واتساب.</p>
          </>
        )}
      </div></div>
      <p className="meta" style={{ textAlign: 'center', marginTop: 12 }}>بدخولك أنت موافق على <a href="#/terms">شروط الاستخدام</a> و<a href="#/privacy">سياسة الخصوصية</a>.</p>
    </div>
  )
}

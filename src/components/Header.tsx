import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { track } from '../lib/analytics'
import NotificationBell from './NotificationBell'

export default function Header() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()

  // Platform owner: a business console, not a marketplace account
  if (profile?.is_owner) {
    return (
      <header className="header owner">
        <div className="inner">
          <NavLink to="/dashboard" className="logo"><span>X</span>عفش <small className="owner-tag">صاحب المنصة</small></NavLink>
          <nav className="nav">
            <NavLink to="/dashboard">📊 لوحة التحكم</NavLink>
            <NavLink to="/" end>👁 تصفح المنصة</NavLink>
            <NavLink to="/account" className="hide-sm">حسابي</NavLink>
            <button onClick={async () => { track('logged_out'); await signOut(); navigate('/') }}>خروج</button>
          </nav>
        </div>
      </header>
    )
  }

  return (
    <header className="header">
      <div className="inner">
        <NavLink to="/" className="logo"><span>X</span>عفش</NavLink>
        <nav className="nav">
          <NavLink to="/" end className="hide-sm">الرئيسية</NavLink>
          {session && <NavLink to="/inbox">الوارد</NavLink>}
          {session && <NavLink to="/my" className="hide-sm">أطقمي</NavLink>}
          {session && <NavLink to="/favorites" className="hide-sm" aria-label="المفضلة">♥</NavLink>}
          {session ? (
            <>
              <NavLink to="/account" className="hide-sm">حسابي</NavLink>
              <button className="hide-sm" onClick={async () => { track('logged_out'); await signOut(); navigate('/') }}>خروج</button>
              <NotificationBell />
            </>
          ) : (
            <NavLink to="/login">دخول</NavLink>
          )}
          <button
            className="cta"
            onClick={() => { track('listing_create_clicked', { logged_in: !!session }); navigate(session ? '/new' : '/login?next=/new') }}
          >
            اعرض طقم +
          </button>
        </nav>
      </div>
    </header>
  )
}

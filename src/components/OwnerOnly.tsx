import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Wraps marketplace-only pages: the platform owner is sent to the dashboard instead. */
export function NotForOwner({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { if (profile?.is_owner) navigate('/dashboard', { replace: true }) }, [profile?.is_owner, navigate])
  if (profile?.is_owner) return null
  return <>{children}</>
}

/** Owner opening the site root lands on the dashboard once per visit; "تصفح المنصة" still works afterwards. */
export function OwnerLanding() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (loading || !profile?.is_owner) return
    try {
      if (sessionStorage.getItem('x3afsh_owner_landed') === '1') return
      sessionStorage.setItem('x3afsh_owner_landed', '1')
    } catch { /* ignore */ }
    navigate('/dashboard', { replace: true })
  }, [loading, profile?.is_owner, navigate])
  return null
}

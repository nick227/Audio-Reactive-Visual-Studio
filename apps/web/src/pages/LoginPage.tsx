import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGoogleAuth, useCurrentUser } from '@avl/sdk'
import { toast } from 'sonner'
import { SITE_NAME } from '../brand/site'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (element: HTMLElement, config: object) => void
        }
      }
    }
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const googleAuth = useGoogleAuth()
  const { data: me } = useCurrentUser()

  useEffect(() => {
    if (me?.data) navigate('/')
  }, [me, navigate])

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const tryInit = () => {
      if (!window.google || !buttonRef.current) return false
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }: { credential: string }) => {
          try {
            await googleAuth.mutateAsync(credential)
            navigate('/')
          } catch {
            toast.error('Sign-in failed. Please try again.')
          }
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: buttonRef.current.offsetWidth || 320,
      })
      return true
    }

    if (tryInit()) return

    const interval = setInterval(() => { if (tryInit()) clearInterval(interval) }, 200)
    const timeout = setTimeout(() => clearInterval(interval), 10_000)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.root}>
      {/* Animated mesh background */}
      <div style={styles.mesh} aria-hidden />

      {/* Centered glass card */}
      <div style={styles.card}>
        {/* Logo mark */}
        <div style={styles.logoWrap}>
          <span style={styles.logoMark} aria-hidden>◈</span>
          <span style={styles.logoName}>{SITE_NAME}</span>
        </div>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.sub}>Sign in to access your saved projects and share your work.</p>

        <div style={styles.divider} />

        <div ref={buttonRef} style={styles.googleBtn} />

        {googleAuth.isPending && (
          <p style={styles.pending}>Signing in…</p>
        )}

        <p style={styles.switchText}>
          New to {SITE_NAME}?{' '}
          <Link to="/register" style={styles.switchLink}>Create an account</Link>
        </p>
      </div>

      {/* Bottom-center wordmark */}
      <p style={styles.footer}>
        All rendering happens in your browser — your audio stays private.
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    background: 'var(--bg-base)',
    overflow: 'hidden',
    padding: '2rem 1rem',
    gap: '2rem',
  },
  mesh: {
    position: 'absolute',
    inset: 0,
    background: [
      'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(120,88,255,.28) 0%, transparent 60%)',
      'radial-gradient(ellipse 40% 40% at 80% 90%, rgba(255,79,216,.12) 0%, transparent 50%)',
      'radial-gradient(ellipse 60% 60% at 20% 110%, rgba(120,88,255,.10) 0%, transparent 55%)',
    ].join(', '),
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '420px',
    padding: '2.5rem 2rem',
    background: 'rgba(26,25,36,.72)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-2xl)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 48px rgba(0,0,0,.45), 0 0 0 1px rgba(120,88,255,.12)',
    gap: '0',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1.75rem',
  },
  logoMark: {
    fontSize: '1.75rem',
    color: 'var(--purple-light)',
    lineHeight: 1,
    filter: 'drop-shadow(0 0 8px var(--purple-glow))',
  },
  logoName: {
    fontSize: '1.1rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--text-hi)',
  },
  heading: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  sub: {
    margin: '0.625rem 0 0',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  divider: {
    width: '100%',
    height: '1px',
    background: 'var(--border-subtle)',
    margin: '1.75rem 0',
  },
  googleBtn: {
    width: '100%',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pending: {
    margin: '0.75rem 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  switchText: {
    margin: '1.5rem 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-dim)',
    textAlign: 'center',
  },
  switchLink: {
    color: 'var(--purple-light)',
    textDecoration: 'none',
    fontWeight: 500,
  },
  footer: {
    position: 'relative',
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text-ghost)',
    textAlign: 'center',
    maxWidth: '340px',
    lineHeight: 1.5,
  },
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleAuth, useEmailLogin, useEmailRegister, useCurrentUser } from '@avl/sdk'
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

type Mode = 'login' | 'register'

export function AuthPage() {
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  const googleAuth = useGoogleAuth()
  const emailLogin = useEmailLogin()
  const emailRegister = useEmailRegister()
  const googleBtnRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [remember, setRemember] = useState(true)

  useEffect(() => {
    if (me?.data) navigate('/')
  }, [me, navigate])

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const tryInit = () => {
      if (!window.google || !googleBtnRef.current) return false
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }: { credential: string }) => {
          try {
            await googleAuth.mutateAsync(credential)
            navigate('/')
          } catch {
            toast.error('Google sign-in failed.')
          }
        },
      })
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.offsetWidth || 340,
      })
      return true
    }

    if (tryInit()) return
    const iv = setInterval(() => { if (tryInit()) clearInterval(iv) }, 200)
    const t = setTimeout(() => clearInterval(iv), 10_000)
    return () => { clearInterval(iv); clearTimeout(t) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending = emailLogin.isPending || emailRegister.isPending || googleAuth.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (mode === 'login') {
        await emailLogin.mutateAsync({ email, password, remember: remember })
      } else {
        await emailRegister.mutateAsync({ email, password, displayName })
      }
      navigate('/')
    } catch (err: any) {
      toast.error(err?.message ?? 'Something went wrong.')
    }
  }

  return (
    <div style={s.root}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logo}>
          <span style={s.logoMark} aria-hidden>◈</span>
          <span style={s.logoName}>{SITE_NAME}</span>
        </div>

        {/* Tab row */}
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(mode === 'login' ? s.tabActive : {}) }}
            onClick={() => setMode('login')}
            type="button"
          >
            Sign in
          </button>
          <button
            style={{ ...s.tab, ...(mode === 'register' ? s.tabActive : {}) }}
            onClick={() => setMode('register')}
            type="button"
          >
            Create account
          </button>
        </div>

        {/* Google button */}
        <div ref={googleBtnRef} style={s.googleBtn} />
        {googleAuth.isPending && <p style={s.hint}>Signing in…</p>}

        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>or</span>
          <div style={s.dividerLine} />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} style={s.form}>
          {mode === 'register' && (
            <input
              style={s.input}
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />
          )}
          <input
            style={s.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            style={s.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'login' && (
            <label style={s.rememberRow}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={s.checkbox}
              />
              <span style={s.rememberLabel}>Remember me</span>
            </label>
          )}
          <button style={{ ...s.submitBtn, ...(isPending ? s.submitBtnDisabled : {}) }} type="submit" disabled={isPending}>
            {isPending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    background: 'var(--bg-base)',
    padding: '1.5rem 1rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '400px',
    padding: '2rem',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-xl)',
    gap: '0',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  logoMark: {
    fontSize: '1.5rem',
    color: 'var(--purple-light)',
    lineHeight: 1,
  },
  logoName: {
    fontSize: '1rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--text-hi)',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border-subtle)',
    marginBottom: '1.5rem',
  },
  tab: {
    flex: 1,
    padding: '0.6rem 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-dim)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: '-1px',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: 'var(--text-primary)',
    borderBottomColor: 'var(--purple)',
  },
  googleBtn: {
    width: '100%',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    margin: '0.5rem 0 0',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    margin: '1.25rem 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'var(--border-subtle)',
  },
  dividerText: {
    fontSize: '0.78rem',
    color: 'var(--text-ghost)',
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.875rem',
    background: 'var(--bg-input, var(--bg-deep))',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  rememberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  checkbox: {
    accentColor: 'var(--purple)',
    width: '14px',
    height: '14px',
  },
  rememberLabel: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  submitBtn: {
    marginTop: '0.25rem',
    padding: '0.65rem',
    background: 'var(--purple)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  submitBtnDisabled: {
    opacity: 0.55,
    cursor: 'default',
  },
}

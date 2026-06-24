import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfirmPasswordReset } from '@avl/sdk'
import { SITE_NAME } from '../brand/site'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const confirmReset = useConfirmPasswordReset()

  if (!token) {
    return (
      <div style={styles.root}>
        <div style={styles.mesh} aria-hidden />
        <div style={styles.card}>
          <p style={styles.errorMsg}>Invalid or missing reset token. Please request a new reset link.</p>
          <button style={styles.btnGhost} onClick={() => navigate('/login')}>Go to sign in</button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={styles.root}>
        <div style={styles.mesh} aria-hidden />
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.heading}>Password updated</h1>
          <p style={styles.sub}>You can now sign in with your new password.</p>
          <button style={styles.btnPrimary} onClick={() => navigate('/login')}>Go to sign in</button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    try {
      await confirmReset.mutateAsync({ token, newPassword: password })
      setDone(true)
    } catch (err: any) {
      toast.error(err?.message ?? 'Invalid or expired reset token')
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.mesh} aria-hidden />
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <span style={styles.logoMark} aria-hidden>◈</span>
          <span style={styles.logoName}>{SITE_NAME}</span>
        </div>

        <h1 style={styles.heading}>Set new password</h1>
        <p style={styles.sub}>Choose a password with at least 8 characters.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>New password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              minLength={8}
              required
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Confirm password</label>
            <input
              style={styles.input}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button type="submit" style={styles.btnPrimary} disabled={confirmReset.isPending}>
            {confirmReset.isPending ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    background: 'var(--bg-base)',
    overflow: 'hidden',
    padding: '2rem 1rem',
  },
  mesh: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(120,88,255,.24) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '400px',
    padding: '2.5rem 2rem',
    background: 'rgba(26,25,36,.72)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-2xl)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 48px rgba(0,0,0,.45)',
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
    fontSize: '1.35rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textAlign: 'center',
  },
  sub: {
    margin: '0.5rem 0 1.5rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--text-dim)',
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    background: 'var(--white-6)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-hi)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    marginTop: '0.5rem',
    height: 40,
    borderRadius: 'var(--radius-md)',
    background: 'var(--purple)',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 0 12px rgba(120,88,255,.35)',
  },
  btnGhost: {
    marginTop: '0.75rem',
    height: 36,
    padding: '0 1rem',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: '1px solid var(--border-base)',
    cursor: 'pointer',
  },
  errorMsg: {
    margin: '0 0 1.25rem',
    fontSize: '0.9rem',
    color: 'var(--danger)',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(61,255,136,.12)',
    border: '1px solid rgba(61,255,136,.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    color: 'var(--success)',
    marginBottom: '1rem',
  },
}

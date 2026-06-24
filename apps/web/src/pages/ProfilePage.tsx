import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCurrentUser, useLogout, useUpdateProfile, useRequestPasswordReset } from '@avl/sdk'
import { SITE_NAME } from '../brand/site'

export function ProfilePage() {
  const navigate = useNavigate()
  const { data: meData, isLoading } = useCurrentUser()
  const logout = useLogout()
  const updateProfile = useUpdateProfile()
  const requestReset = useRequestPasswordReset()

  const user = meData?.data

  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  if (isLoading) return <div style={styles.root} />

  if (!user) {
    navigate('/login')
    return null
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    const name = displayName.trim()
    if (!name) return
    try {
      await updateProfile.mutateAsync({ displayName: name })
      toast.success('Display name updated')
      setEditingName(false)
    } catch {
      toast.error('Failed to update name')
    }
  }

  async function handleRequestReset() {
    try {
      await requestReset.mutateAsync(user!.email)
      setResetSent(true)
      toast.success('Password reset link sent (check server console in dev)')
    } catch {
      toast.error('Failed to send reset email')
    }
  }

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/login')
  }

  return (
    <div style={styles.root}>
      <div style={styles.mesh} aria-hidden />

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <a href="/" style={styles.backLink}>← {SITE_NAME}</a>
          <h1 style={styles.pageTitle}>Profile</h1>
        </div>

        {/* Account card */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.avatarWrap}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} style={styles.avatar} />
              ) : (
                <div style={styles.avatarFallback}>
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div style={styles.accountInfo}>
              <span style={styles.accountName}>{user.displayName}</span>
              <span style={styles.accountEmail}>{user.email}</span>
              <span style={user.role === 'ADMIN' ? styles.roleAdmin : styles.roleUser}>
                {user.role}
              </span>
            </div>
          </div>
        </section>

        {/* Edit display name */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Display name</h2>
          {editingName ? (
            <form onSubmit={handleSaveName} style={styles.form}>
              <input
                style={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user.displayName}
                autoFocus
                maxLength={80}
              />
              <div style={styles.formRow}>
                <button type="submit" style={styles.btnPrimary} disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  style={styles.btnGhost}
                  onClick={() => setEditingName(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div style={styles.formRow}>
              <span style={styles.fieldValue}>{user.displayName}</span>
              <button
                style={styles.btnGhost}
                onClick={() => { setDisplayName(user.displayName); setEditingName(true) }}
              >
                Edit
              </button>
            </div>
          )}
        </section>

        {/* Password reset */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Password</h2>
          <p style={styles.sectionDesc}>
            {resetSent
              ? 'Reset link sent — check the server console in dev, or your inbox in production.'
              : 'Send a password reset link to your email address. In dev the link prints to the server console.'}
          </p>
          {!resetSent && (
            <button
              style={styles.btnGhost}
              onClick={handleRequestReset}
              disabled={requestReset.isPending}
            >
              {requestReset.isPending ? 'Sending…' : 'Send reset link'}
            </button>
          )}
        </section>

        {/* Media history — placeholder until Phase 2 */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Media history</h2>
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>🎵</span>
            <p style={styles.emptyText}>
              Personal upload history will appear here once media uploads are enabled in Phase 2.
            </p>
          </div>
        </section>

        {/* Danger zone */}
        <section style={{ ...styles.card, borderColor: 'rgba(255,80,80,.2)' }}>
          <h2 style={{ ...styles.sectionTitle, color: 'var(--danger)' }}>Session</h2>
          <button style={styles.btnDanger} onClick={handleLogout} disabled={logout.isPending}>
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </section>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    minHeight: '100dvh',
    background: 'var(--bg-base)',
    overflow: 'hidden',
  },
  mesh: {
    position: 'absolute',
    inset: 0,
    background: [
      'radial-gradient(ellipse 60% 40% at 70% -5%, rgba(120,88,255,.18) 0%, transparent 60%)',
      'radial-gradient(ellipse 40% 50% at 20% 90%, rgba(120,88,255,.08) 0%, transparent 55%)',
    ].join(', '),
    pointerEvents: 'none',
  },
  page: {
    position: 'relative',
    maxWidth: '620px',
    margin: '0 auto',
    padding: '2rem 1.25rem 4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  backLink: {
    fontSize: '0.8rem',
    color: 'var(--text-dim)',
    textDecoration: 'none',
  },
  pageTitle: {
    margin: 0,
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  card: {
    background: 'rgba(26,25,36,.6)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-xl)',
    padding: '1.375rem 1.5rem',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  avatarWrap: { flexShrink: 0 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    border: '2px solid var(--border-base)',
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'var(--purple-dim)',
    border: '2px solid var(--purple-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--purple-light)',
  },
  accountInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  accountName: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-hi)',
  },
  accountEmail: {
    fontSize: '0.85rem',
    color: 'var(--text-dim)',
  },
  roleUser: {
    display: 'inline-block',
    padding: '1px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    background: 'var(--white-8)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-dim)',
    width: 'fit-content',
  },
  roleAdmin: {
    display: 'inline-block',
    padding: '1px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    background: 'var(--purple-dim)',
    color: 'var(--purple-light)',
    border: '1px solid var(--purple-border)',
    width: 'fit-content',
  },
  sectionTitle: {
    margin: '0 0 0.75rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-mid)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  sectionDesc: {
    margin: '0 0 1rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  formRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
  },
  fieldValue: {
    fontSize: '0.9rem',
    color: 'var(--text-hi)',
    flex: 1,
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
    height: 32,
    padding: '0 0.875rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--purple)',
    color: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
  },
  btnGhost: {
    height: 32,
    padding: '0 0.875rem',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    border: '1px solid var(--border-base)',
    cursor: 'pointer',
  },
  btnDanger: {
    height: 32,
    padding: '0 0.875rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--danger-dim)',
    color: 'var(--danger)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    border: '1px solid rgba(255,80,80,.3)',
    cursor: 'pointer',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1.5rem 0.5rem',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '1.75rem',
    opacity: 0.4,
  },
  emptyText: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
    lineHeight: 1.55,
    maxWidth: '320px',
  },
}

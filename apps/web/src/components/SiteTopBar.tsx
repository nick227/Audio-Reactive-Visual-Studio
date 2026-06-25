import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@avl/sdk'
import { SITE_NAME } from '../brand/site'

interface Props {
  onSaveToCloud?: () => void
  isSaving?: boolean
  lastCloudSaved?: string | null
  localSavedAt?: string | null
}

function cloudBtnLabel(isSaving: boolean, lastCloudSaved: string | null | undefined): string {
  if (isSaving) return 'Saving…'
  if (lastCloudSaved) {
    const secAgo = (Date.now() - new Date(lastCloudSaved).getTime()) / 1000
    if (secAgo < 60) return 'Synced ✓'
  }
  return 'Save to Cloud'
}

export function SiteTopBar({ onSaveToCloud, isSaving = false, lastCloudSaved, localSavedAt }: Props) {
  const navigate = useNavigate()
  const { data: me, isLoading } = useCurrentUser()
  const user = me?.data

  const showLocal = Boolean(localSavedAt)
  const cloudLabel = cloudBtnLabel(isSaving, lastCloudSaved)

  return (
    <header className="site-topbar">
      <div className="site-topbar-inner">
        <a className="site-brand" href="/" aria-label={`${SITE_NAME} home`}>
          <span className="site-name">{SITE_NAME}</span>
        </a>

        <div style={styles.right}>
          {showLocal && (
            <span style={styles.savedLocal} title="Autosaved to this browser">
              <span style={styles.dot} aria-hidden>●</span>
              Saved locally
            </span>
          )}

          {!isLoading && !user && (
            <>
              <button className="topbar-btn topbar-btn--ghost" onClick={() => navigate('/login')}>
                Sign in
              </button>
              <button className="topbar-btn topbar-btn--primary" onClick={() => navigate('/login')}>
                Get started
              </button>
            </>
          )}

          {user && onSaveToCloud && (
            <>
            | <a
              className="topbar-link"
              style={styles.savedLocal}
              onClick={onSaveToCloud}
              title="Save project structure to cloud (files stay local until Phase 2)"
            >
            {cloudLabel}
            </a>
            </>
          )}

          {user && (
            <>
              {user.role === 'ADMIN' && (
                <button
                  className="topbar-btn topbar-btn--ghost"
                  onClick={() => navigate('/admin')}
                  style={{ fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--purple-light)' }}
                >
                  Admin
                </button>
              )}
              <button
                className="topbar-btn topbar-btn--ghost"
                onClick={() => navigate('/profile')}
                title={`Profile — ${user.displayName}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {user.avatarUrl && (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    style={{ width: 24, height: 24, borderRadius: '50%' }}
                  />
                )}
                <span style={{ fontSize: '0.8rem' }}>{user.displayName}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

const styles: Record<string, React.CSSProperties> = {
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginLeft: 'auto',
  },
  savedLocal: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.75rem',
    color: 'var(--text-ghost)',
    userSelect: 'none',
  },
  dot: {
    fontSize: '0.5rem',
    color: 'var(--green, #4ade80)',
    lineHeight: 1,
  },
}

import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@avl/sdk'
import { SITE_NAME } from '../brand/site'

interface Props {
  onSaveToCloud?: () => void
  isSaving?: boolean
  cloudProjectId?: string | null
}

export function SiteTopBar({ onSaveToCloud, isSaving, cloudProjectId }: Props) {
  const navigate = useNavigate()
  const { data: me, isLoading } = useCurrentUser()
  const user = me?.data

  return (
    <header className="site-topbar">
      <div className="site-topbar-inner">
        <a className="site-brand" href="/" aria-label={`${SITE_NAME} home`}>
          <span className="site-name">{SITE_NAME}</span>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
          {!isLoading && !user && (
            <>
              <button
                className="topbar-btn topbar-btn--ghost"
                onClick={() => navigate('/login')}
              >
                Sign in
              </button>
              <button
                className="topbar-btn topbar-btn--primary"
                onClick={() => navigate('/register')}
              >
                Get started
              </button>
            </>
          )}

          {user && onSaveToCloud && (
            <button
              className="topbar-btn topbar-btn--primary"
              onClick={onSaveToCloud}
              disabled={isSaving}
              title={cloudProjectId ? 'Save changes to cloud' : 'Save project to cloud'}
            >
              {isSaving ? 'Saving…' : cloudProjectId ? 'Saved ✓' : 'Save to Cloud'}
            </button>
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

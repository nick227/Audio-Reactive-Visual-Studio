import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@avl/sdk'
import { SITE_NAME } from '../brand/site'
import { ProjectSwitcher } from './ProjectSwitcher'
import type { ProjectIndexEntry } from '../features/visualizer/project/projectLibrary'

interface Props {
  localSavedAt?: string | null
  projectName: string
  projects: ProjectIndexEntry[]
  activeProjectId: string
  onRenameProject: (name: string) => void
  onSwitchProject: (id: string) => void
  onCreateProject: () => void
  onDuplicateProject: (id: string) => void
  onDeleteProject: (id: string) => void | Promise<void>
}

export function SiteTopBar({
  localSavedAt,
  projectName,
  projects,
  activeProjectId,
  onRenameProject,
  onSwitchProject,
  onCreateProject,
  onDuplicateProject,
  onDeleteProject,
}: Props) {
  const navigate = useNavigate()
  const { data: me, isLoading } = useCurrentUser()
  const user = me?.data

  const showLocal = Boolean(localSavedAt)

  return (
    <header className="site-topbar">
      <div className="site-topbar-inner">
        <a className="site-brand" href="/" aria-label={`${SITE_NAME} home`}>
          <span className="site-name">{SITE_NAME}</span>
        </a>

        <ProjectSwitcher
          projectName={projectName}
          projects={projects}
          activeProjectId={activeProjectId}
          onRename={onRenameProject}
          onSwitch={onSwitchProject}
          onCreate={onCreateProject}
          onDuplicate={onDuplicateProject}
          onDelete={onDeleteProject}
        />

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

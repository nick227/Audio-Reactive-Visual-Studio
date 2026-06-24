import { useState } from 'react'
import { toast } from 'sonner'
import {
  useAdminUsers,
  useUpdateAdminUser,
  useDeleteAdminUser,
  useCommunityAssets,
  useUpdateCommunityAsset,
  useDeleteCommunityAsset,
  useCurrentUser,
} from '@avl/sdk'

type User = {
  id: string
  email: string
  displayName: string
  role: string
  suspendedAt: string | null
  createdAt: string
}

type CommunityAsset = {
  id: string
  filename: string
  title: string | null
  mimeType: string
  sizeBytes: number
  published: boolean
  createdAt: string
}

export function AdminPage() {
  const { data: meData } = useCurrentUser()
  const meId = meData?.data?.id

  const { data: usersData, isLoading: loadingUsers } = useAdminUsers()
  const { data: assetsData, isLoading: loadingAssets } = useCommunityAssets()
  const updateUser = useUpdateAdminUser()
  const deleteUser = useDeleteAdminUser()
  const updateAsset = useUpdateCommunityAsset()
  const deleteAsset = useDeleteCommunityAsset()

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const users: User[] = (usersData?.data as User[]) ?? []
  const assets: CommunityAsset[] = (assetsData?.data as CommunityAsset[]) ?? []

  async function handleRoleChange(id: string, role: 'USER' | 'ADMIN') {
    try {
      await updateUser.mutateAsync({ id, role })
      toast.success('Role updated')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update role')
    }
  }

  async function handleSuspend(id: string, suspended: boolean) {
    try {
      await updateUser.mutateAsync({ id, suspended })
      toast.success(suspended ? 'User suspended' : 'User unsuspended')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update user')
    }
  }

  async function handleDeleteUser(id: string) {
    try {
      await deleteUser.mutateAsync(id)
      toast.success('User deleted')
      setConfirmDeleteId(null)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete user')
    }
  }

  async function handleTogglePublish(id: string, published: boolean) {
    try {
      await updateAsset.mutateAsync({ id, published })
      toast.success(published ? 'Asset published' : 'Asset unpublished')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update asset')
    }
  }

  async function handleDeleteAsset(id: string) {
    try {
      await deleteAsset.mutateAsync(id)
      toast.success('Asset deleted')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete asset')
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.mesh} aria-hidden />

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <a href="/" style={styles.backLink}>← Home</a>
          <div style={styles.headerRow}>
            <h1 style={styles.pageTitle}>Admin</h1>
            <span style={styles.adminBadge}>ADMIN</span>
          </div>
        </div>

        {/* ── Users section ─────────────────────────────────────── */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Users</h2>

          {loadingUsers ? (
            <div style={styles.emptyText}>Loading…</div>
          ) : users.length === 0 ? (
            <div style={styles.emptyText}>No users found.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['User', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={u.id === meId ? styles.trSelf : styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.userCell}>
                          <span style={styles.userName}>{u.displayName}</span>
                          <span style={styles.userEmail}>{u.email}</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <select
                          style={styles.roleSelect}
                          value={u.role}
                          disabled={u.id === meId}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as 'USER' | 'ADMIN')}
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td style={styles.td}>
                        <span style={u.suspendedAt ? styles.statusSuspended : styles.statusActive}>
                          {u.suspendedAt ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.dateText}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionRow}>
                          {u.id !== meId && (
                            <>
                              <button
                                style={styles.actionBtn}
                                onClick={() => handleSuspend(u.id, !u.suspendedAt)}
                                disabled={updateUser.isPending}
                              >
                                {u.suspendedAt ? 'Unsuspend' : 'Suspend'}
                              </button>
                              {confirmDeleteId === u.id ? (
                                <>
                                  <button
                                    style={styles.actionBtnDanger}
                                    onClick={() => handleDeleteUser(u.id)}
                                    disabled={deleteUser.isPending}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    style={styles.actionBtn}
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  style={styles.actionBtnDanger}
                                  onClick={() => setConfirmDeleteId(u.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                          {u.id === meId && (
                            <span style={styles.selfLabel}>You</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Community assets section ───────────────────────────── */}
        <section style={styles.card}>
          <div style={styles.sectionHeaderRow}>
            <h2 style={styles.sectionTitle}>Community assets</h2>
            <button
              style={styles.uploadBtnDisabled}
              disabled
              title="R2 upload coming in Phase 2"
            >
              Upload (Phase 2)
            </button>
          </div>

          {loadingAssets ? (
            <div style={styles.emptyText}>Loading…</div>
          ) : assets.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyStateText}>No community assets yet.</p>
              <p style={styles.emptyStateHint}>
                R2 upload will be enabled in Phase 2. Once wired, admins can upload media
                here for use across all projects.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['File', 'Type', 'Size', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.userCell}>
                          <span style={styles.userName}>{a.title ?? a.filename}</span>
                          {a.title && <span style={styles.userEmail}>{a.filename}</span>}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.dateText}>{a.mimeType.split('/')[1] ?? a.mimeType}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.dateText}>{(a.sizeBytes / 1024).toFixed(0)} KB</span>
                      </td>
                      <td style={styles.td}>
                        <span style={a.published ? styles.statusActive : styles.statusSuspended}>
                          {a.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionRow}>
                          <button
                            style={styles.actionBtn}
                            onClick={() => handleTogglePublish(a.id, !a.published)}
                            disabled={updateAsset.isPending}
                          >
                            {a.published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            style={styles.actionBtnDanger}
                            onClick={() => handleDeleteAsset(a.id)}
                            disabled={deleteAsset.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
    background: 'radial-gradient(ellipse 80% 40% at 60% -10%, rgba(120,88,255,.14) 0%, transparent 55%)',
    pointerEvents: 'none',
  },
  page: {
    position: 'relative',
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '2rem 1.25rem 4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  backLink: {
    fontSize: '0.8rem',
    color: 'var(--text-dim)',
    textDecoration: 'none',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
  },
  pageTitle: {
    margin: 0,
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  adminBadge: {
    padding: '2px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    background: 'var(--purple-dim)',
    color: 'var(--purple-light)',
    border: '1px solid var(--purple-border)',
  },
  card: {
    background: 'rgba(26,25,36,.6)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-xl)',
    padding: '1.375rem 1.5rem',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  sectionTitle: {
    margin: '0 0 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-mid)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '0.5rem 0.75rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border-subtle)',
  },
  tr: {
    borderBottom: '1px solid var(--border-faint)',
  },
  trSelf: {
    borderBottom: '1px solid var(--border-faint)',
    background: 'var(--white-3)',
  },
  td: {
    padding: '0.625rem 0.75rem',
    verticalAlign: 'middle',
  },
  userCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userName: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-hi)',
  },
  userEmail: {
    fontSize: '0.775rem',
    color: 'var(--text-muted)',
  },
  roleSelect: {
    background: 'var(--white-8)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    padding: '2px 6px',
    cursor: 'pointer',
  },
  statusActive: {
    fontSize: '0.775rem',
    fontWeight: 500,
    color: 'var(--success)',
  },
  statusSuspended: {
    fontSize: '0.775rem',
    fontWeight: 500,
    color: 'var(--warn)',
  },
  dateText: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  actionRow: {
    display: 'flex',
    gap: '0.375rem',
    flexWrap: 'wrap',
  },
  actionBtn: {
    height: 26,
    padding: '0 0.625rem',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--white-8)',
    color: 'var(--text-secondary)',
    fontSize: '0.775rem',
    fontWeight: 500,
    border: '1px solid var(--border-base)',
    cursor: 'pointer',
  },
  actionBtnDanger: {
    height: 26,
    padding: '0 0.625rem',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--danger-dim)',
    color: 'var(--danger)',
    fontSize: '0.775rem',
    fontWeight: 500,
    border: '1px solid rgba(255,80,80,.25)',
    cursor: 'pointer',
  },
  selfLabel: {
    fontSize: '0.775rem',
    color: 'var(--text-ghost)',
    fontStyle: 'italic',
  },
  uploadBtnDisabled: {
    height: 30,
    padding: '0 0.875rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--white-4)',
    color: 'var(--text-ghost)',
    fontSize: '0.8rem',
    fontWeight: 500,
    border: '1px solid var(--border-subtle)',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
    padding: '0.5rem 0',
  },
  emptyState: {
    padding: '1.25rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  emptyStateText: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'var(--text-dim)',
  },
  emptyStateHint: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: 1.55,
    maxWidth: '480px',
  },
}

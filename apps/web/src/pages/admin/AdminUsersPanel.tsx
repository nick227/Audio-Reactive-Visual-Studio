import { useState } from 'react'
import { toast } from 'sonner'
import { useAdminUsers, useUpdateAdminUser, useDeleteAdminUser } from '@avl/sdk'
import { adminStyles as s } from './adminStyles'

type User = {
  id: string
  email: string
  displayName: string
  role: string
  suspendedAt: string | null
  createdAt: string
}

type Props = {
  meId?: string
}

const panelStyles: Record<string, React.CSSProperties> = {
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '0.5rem 0.75rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border-subtle)',
  },
  tr: { borderBottom: '1px solid var(--border-faint)' },
  trSelf: { borderBottom: '1px solid var(--border-faint)', background: 'var(--white-3)' },
  td: { padding: '0.625rem 0.75rem', verticalAlign: 'middle' },
  userCell: { display: 'flex', flexDirection: 'column', gap: '2px' },
  userName: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-hi)' },
  userEmail: { fontSize: '0.775rem', color: 'var(--text-muted)' },
  roleSelect: {
    background: 'var(--white-8)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    padding: '2px 6px',
    cursor: 'pointer',
  },
  statusActive: { fontSize: '0.775rem', fontWeight: 500, color: 'var(--success)' },
  statusSuspended: { fontSize: '0.775rem', fontWeight: 500, color: 'var(--warn)' },
  dateText: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  actionRow: { display: 'flex', gap: '0.375rem', flexWrap: 'wrap' },
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
  selfLabel: { fontSize: '0.775rem', color: 'var(--text-ghost)', fontStyle: 'italic' },
}

export function AdminUsersPanel({ meId }: Props) {
  const { data: usersData, isLoading } = useAdminUsers()
  const updateUser = useUpdateAdminUser()
  const deleteUser = useDeleteAdminUser()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const users: User[] = (usersData?.data as User[]) ?? []

  async function handleRoleChange(id: string, role: 'USER' | 'ADMIN') {
    try {
      await updateUser.mutateAsync({ id, role })
      toast.success('Role updated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  async function handleSuspend(id: string, suspended: boolean) {
    try {
      await updateUser.mutateAsync({ id, suspended })
      toast.success(suspended ? 'User suspended' : 'User unsuspended')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  async function handleDeleteUser(id: string) {
    try {
      await deleteUser.mutateAsync(id)
      toast.success('User deleted')
      setConfirmDeleteId(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  return (
    <section style={s.card}>
      <h2 style={s.sectionTitle}>Users</h2>

      {isLoading ? (
        <div style={s.emptyText}>Loading…</div>
      ) : users.length === 0 ? (
        <div style={s.emptyText}>No users found.</div>
      ) : (
        <div style={panelStyles.tableWrap}>
          <table style={panelStyles.table}>
            <thead>
              <tr>
                {['User', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} style={panelStyles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={u.id === meId ? panelStyles.trSelf : panelStyles.tr}>
                  <td style={panelStyles.td}>
                    <div style={panelStyles.userCell}>
                      <span style={panelStyles.userName}>{u.displayName}</span>
                      <span style={panelStyles.userEmail}>{u.email}</span>
                    </div>
                  </td>
                  <td style={panelStyles.td}>
                    <select
                      style={panelStyles.roleSelect}
                      value={u.role}
                      disabled={u.id === meId}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as 'USER' | 'ADMIN')}
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td style={panelStyles.td}>
                    <span style={u.suspendedAt ? panelStyles.statusSuspended : panelStyles.statusActive}>
                      {u.suspendedAt ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td style={panelStyles.td}>
                    <span style={panelStyles.dateText}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={panelStyles.td}>
                    <div style={panelStyles.actionRow}>
                      {u.id !== meId && (
                        <>
                          <button
                            style={panelStyles.actionBtn}
                            onClick={() => handleSuspend(u.id, !u.suspendedAt)}
                            disabled={updateUser.isPending}
                          >
                            {u.suspendedAt ? 'Unsuspend' : 'Suspend'}
                          </button>
                          {confirmDeleteId === u.id ? (
                            <>
                              <button
                                style={panelStyles.actionBtnDanger}
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={deleteUser.isPending}
                              >
                                Confirm
                              </button>
                              <button
                                style={panelStyles.actionBtn}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              style={panelStyles.actionBtnDanger}
                              onClick={() => setConfirmDeleteId(u.id)}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                      {u.id === meId && <span style={panelStyles.selfLabel}>You</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

import { useState } from 'react'
import { useCurrentUser } from '@avl/sdk'
import { adminStyles as s } from './admin/adminStyles'
import { AdminUsersPanel } from './admin/AdminUsersPanel'
import { AdminAssetsDashboard } from './admin/AdminAssetsDashboard'

type AdminTab = 'users' | 'assets'

export function AdminPage() {
  const { data: meData } = useCurrentUser()
  const meId = meData?.data?.id
  const [tab, setTab] = useState<AdminTab>('assets')

  return (
    <div style={s.root}>
      <div style={s.mesh} aria-hidden />

      <div style={s.page}>
        <div style={s.header}>
          <a href="/" style={s.backLink}>← Home</a>
          <div style={s.headerRow}>
            <h1 style={s.pageTitle}>Admin</h1>
            <span style={s.adminBadge}>ADMIN</span>
          </div>
        </div>

        <div style={s.tabs} role="tablist" aria-label="Admin sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            style={{ ...s.tab, ...(tab === 'users' ? s.tabActive : {}) }}
            onClick={() => setTab('users')}
          >
            Users
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'assets'}
            style={{ ...s.tab, ...(tab === 'assets' ? s.tabActive : {}) }}
            onClick={() => setTab('assets')}
          >
            Assets
          </button>
        </div>

        {tab === 'users' ? <AdminUsersPanel meId={meId} /> : <AdminAssetsDashboard />}
      </div>
    </div>
  )
}

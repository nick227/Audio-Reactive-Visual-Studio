import { useMemo, useState } from 'react'
import { Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCommunityAssets,
  useUpdateCommunityAsset,
  useDeleteCommunityAsset,
} from '@avl/sdk'
import { communityAssets } from '../../features/visualizer/assets/registry'
import { COMMUNITY_SECTIONS } from '../../features/visualizer/fx/fxLibrary'
import type { AssetCollection } from '../../features/visualizer/project/types'
import { AssetCard } from './AssetCard'
import { adminStyles as s } from './adminStyles'
import { formatBytes, mimeCategory, type MimeCategory } from './assetUtils'
import type { CommunityAsset } from './types'

type StatusFilter = 'all' | 'published' | 'draft'
type TypeFilter = 'all' | MimeCategory

const dash: Record<string, React.CSSProperties> = {
  stack: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
  },
  statCard: {
    padding: '1rem 1.125rem',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--white-4)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-hi)',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoBanner: {
    padding: '0.875rem 1rem',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--purple-dim)',
    border: '1px solid var(--purple-border)',
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
  },
  infoTitle: {
    display: 'block',
    fontWeight: 600,
    color: 'var(--purple-light)',
    marginBottom: '0.25rem',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  chip: {
    padding: '3px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    fontWeight: 500,
    background: 'var(--white-6)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-dim)',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.625rem',
    justifyContent: 'space-between',
  },
  toolbarLeft: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1,
    minWidth: 0,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: '1 1 200px',
    maxWidth: '320px',
    height: 34,
    padding: '0 0.75rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--white-6)',
    border: '1px solid var(--border-base)',
    color: 'var(--text-muted)',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    background: 'none',
    border: 'none',
    outline: 'none',
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
  },
  filterChip: {
    height: 30,
    padding: '0 0.75rem',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.775rem',
    fontWeight: 500,
    background: 'var(--white-4)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-dim)',
    cursor: 'pointer',
  },
  filterChipActive: {
    background: 'var(--purple-dim)',
    borderColor: 'var(--purple-border)',
    color: 'var(--purple-light)',
  },
  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    height: 34,
    padding: '0 0.875rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--white-4)',
    color: 'var(--text-ghost)',
    fontSize: '0.8rem',
    fontWeight: 500,
    border: '1px solid var(--border-subtle)',
    cursor: 'not-allowed',
    opacity: 0.65,
    flexShrink: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '0.875rem',
  },
  emptyState: {
    padding: '2.5rem 1rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 'var(--radius-lg)',
    background: 'var(--white-6)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    marginBottom: '0.25rem',
  },
  emptyTitle: { margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dim)' },
  emptyHint: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: 1.55,
    maxWidth: '420px',
  },
}

function studioPackStats() {
  const byCollection = COMMUNITY_SECTIONS.map(({ collection, label }) => ({
    label,
    count: communityAssets.filter((a) => a.collection === collection).length,
  }))
  const studioCount = communityAssets.filter((a) => a.collection !== 'uploads').length
  return { studioCount, byCollection }
}

function countByCollection(collection: AssetCollection) {
  return communityAssets.filter((a) => a.collection === collection).length
}

export function AdminAssetsDashboard() {
  const { data: assetsData, isLoading } = useCommunityAssets()
  const updateAsset = useUpdateCommunityAsset()
  const deleteAsset = useDeleteCommunityAsset()

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const assets: CommunityAsset[] = (assetsData?.data as CommunityAsset[]) ?? []
  const { studioCount, byCollection } = useMemo(studioPackStats, [])

  const stats = useMemo(() => {
    const published = assets.filter((a) => a.published).length
    const totalBytes = assets.reduce((sum, a) => sum + a.sizeBytes, 0)
    return { total: assets.length, published, draft: assets.length - published, totalBytes }
  }, [assets])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assets.filter((a) => {
      if (statusFilter === 'published' && !a.published) return false
      if (statusFilter === 'draft' && a.published) return false
      const cat = mimeCategory(a.mimeType)
      if (typeFilter !== 'all' && cat !== typeFilter) return false
      if (!q) return true
      const hay = `${a.title ?? ''} ${a.filename} ${a.fileKey}`.toLowerCase()
      return hay.includes(q)
    })
  }, [assets, query, statusFilter, typeFilter])

  async function handleTogglePublish(id: string, published: boolean) {
    try {
      await updateAsset.mutateAsync({ id, published })
      toast.success(published ? 'Asset published' : 'Moved to draft')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update asset')
    }
  }

  async function handleSaveTitle(id: string) {
    const title = editTitle.trim() || null
    try {
      await updateAsset.mutateAsync({ id, title })
      toast.success('Title updated')
      setEditingId(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update title')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAsset.mutateAsync(id)
      toast.success('Asset deleted')
      setConfirmDeleteId(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete asset')
    }
  }

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: `All (${stats.total})` },
    { id: 'published', label: `Published (${stats.published})` },
    { id: 'draft', label: `Draft (${stats.draft})` },
  ]

  const typeFilters: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All types' },
    { id: 'image', label: 'Images' },
    { id: 'video', label: 'Videos' },
    { id: 'audio', label: 'Audio' },
    { id: 'other', label: 'Other' },
  ]

  return (
    <div style={dash.stack}>
      {/* Studio pack overview */}
      <section style={s.card}>
        <h2 style={s.sectionTitle}>Library overview</h2>
        <div style={dash.statsRow}>
          <div style={dash.statCard}>
            <span style={dash.statValue}>{studioCount}</span>
            <span style={dash.statLabel}>Studio pack</span>
          </div>
          <div style={dash.statCard}>
            <span style={dash.statValue}>{stats.total}</span>
            <span style={dash.statLabel}>Cloud uploads</span>
          </div>
          <div style={dash.statCard}>
            <span style={dash.statValue}>{stats.published}</span>
            <span style={dash.statLabel}>Published</span>
          </div>
          <div style={dash.statCard}>
            <span style={dash.statValue}>{formatBytes(stats.totalBytes)}</span>
            <span style={dash.statLabel}>Cloud storage</span>
          </div>
        </div>

        <div style={{ ...dash.infoBanner, marginTop: '1rem' }}>
          <span style={dash.infoTitle}>Two-tier community library</span>
          The bundled studio pack ({studioCount} JSON templates) ships with the app and powers
          the layer browser. Cloud uploads are admin-managed media stored in R2 — publish them
          to make stock images, videos, and audio available across all projects.
        </div>

        <div style={{ ...dash.chipRow, marginTop: '0.875rem' }}>
          {byCollection.map(({ label, count }) => (
            <span key={label} style={dash.chip}>{label} · {count}</span>
          ))}
          {countByCollection('uploads') > 0 && (
            <span style={dash.chip}>Uploads · {countByCollection('uploads')}</span>
          )}
        </div>
      </section>

      {/* Cloud asset manager */}
      <section style={s.card}>
        <div style={dash.toolbar}>
          <h2 style={{ ...s.sectionTitle, margin: 0 }}>Cloud library</h2>
          <button style={dash.uploadBtn} disabled title="R2 upload coming in Phase 2">
            <Upload size={14} />
            Upload (Phase 2)
          </button>
        </div>

        <div style={{ ...dash.toolbar, marginTop: '1rem', marginBottom: '1rem' }}>
          <div style={dash.toolbarLeft}>
            <label style={dash.searchWrap}>
              <Search size={15} />
              <input
                style={dash.searchInput}
                value={query}
                placeholder="Search by title or filename…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div style={dash.chipRow}>
              {statusFilters.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  style={{
                    ...dash.filterChip,
                    ...(statusFilter === id ? dash.filterChipActive : {}),
                  }}
                  onClick={() => setStatusFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...dash.chipRow, marginBottom: '1rem' }}>
          {typeFilters.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              style={{
                ...dash.filterChip,
                ...(typeFilter === id ? dash.filterChipActive : {}),
              }}
              onClick={() => setTypeFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={s.emptyText}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={dash.emptyState}>
            <div style={dash.emptyIcon}><Upload size={22} /></div>
            <p style={dash.emptyTitle}>
              {assets.length === 0 ? 'No cloud assets yet' : 'No assets match your filters'}
            </p>
            <p style={dash.emptyHint}>
              {assets.length === 0
                ? 'R2 upload will be enabled in Phase 2. Published cloud media will appear in the layer browser alongside the studio pack.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        ) : (
          <div style={dash.grid}>
            {filtered.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                editing={editingId === asset.id}
                editTitle={editTitle}
                confirmDelete={confirmDeleteId === asset.id}
                pending={updateAsset.isPending || deleteAsset.isPending}
                onStartEdit={() => {
                  setEditingId(asset.id)
                  setEditTitle(asset.title ?? '')
                }}
                onEditTitle={setEditTitle}
                onSaveTitle={() => handleSaveTitle(asset.id)}
                onCancelEdit={() => setEditingId(null)}
                onTogglePublish={() => handleTogglePublish(asset.id, !asset.published)}
                onRequestDelete={() => setConfirmDeleteId(asset.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onConfirmDelete={() => handleDelete(asset.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCommunityAssets,
  useUpdateCommunityAsset,
  useDeleteCommunityAsset,
} from '@avl/sdk'
import { AssetCard } from './AssetCard'
import { CloudUploadButton } from './CloudUploadButton'
import { adminStyles as s } from './adminStyles'
import { formatBytes, mimeCategory, type MimeCategory } from './assetUtils'
import type { CommunityAsset } from './types'

type StatusFilter = 'all' | 'published' | 'draft'
type TypeFilter = 'all' | MimeCategory

const panel: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.625rem', justifyContent: 'space-between' },
  toolbarLeft: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 200px', maxWidth: '320px',
    height: 34, padding: '0 0.75rem', borderRadius: 'var(--radius-md)',
    background: 'var(--white-6)', border: '1px solid var(--border-base)', color: 'var(--text-muted)',
  },
  searchInput: { flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: '0.825rem', color: 'var(--text-secondary)' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
  filterChip: {
    height: 30, padding: '0 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.775rem', fontWeight: 500,
    background: 'var(--white-4)', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)', cursor: 'pointer',
  },
  filterChipActive: { background: 'var(--purple-dim)', borderColor: 'var(--purple-border)', color: 'var(--purple-light)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' },
}

export function CloudLibraryPanel() {
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
      if (typeFilter !== 'all' && mimeCategory(a.mimeType) !== typeFilter) return false
      if (!q) return true
      return `${a.title ?? ''} ${a.filename}`.toLowerCase().includes(q)
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
    try {
      await updateAsset.mutateAsync({ id, title: editTitle.trim() || null })
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
    { id: 'published', label: `Live (${stats.published})` },
    { id: 'draft', label: `Draft (${stats.draft})` },
  ]

  return (
    <section style={s.card}>
      <div style={panel.toolbar}>
        <div>
          <h2 style={{ ...s.sectionTitle, margin: 0 }}>Cloud library</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {formatBytes(stats.totalBytes)} stored · publish to expose in the layer browser
          </p>
        </div>
        <CloudUploadButton />
      </div>

      <div style={{ ...panel.toolbar, marginTop: '1rem', marginBottom: '0.75rem' }}>
        <div style={panel.toolbarLeft}>
          <label style={panel.searchWrap}>
            <Search size={15} />
            <input style={panel.searchInput} value={query} placeholder="Search cloud assets…" onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div style={panel.chipRow}>
            {statusFilters.map(({ id, label }) => (
              <button key={id} type="button" style={{ ...panel.filterChip, ...(statusFilter === id ? panel.filterChipActive : {}) }} onClick={() => setStatusFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={s.emptyText}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={s.emptyText}>{assets.length === 0 ? 'Upload images, videos, or audio to the cloud library.' : 'No assets match your filters.'}</div>
      ) : (
        <div style={panel.grid}>
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              editing={editingId === asset.id}
              editTitle={editTitle}
              confirmDelete={confirmDeleteId === asset.id}
              pending={updateAsset.isPending || deleteAsset.isPending}
              onStartEdit={() => { setEditingId(asset.id); setEditTitle(asset.title ?? '') }}
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
  )
}

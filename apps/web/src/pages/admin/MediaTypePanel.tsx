import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCommunityAssets,
  useUpdateCommunityAsset,
  useDeleteCommunityAsset,
  useLibraryOverrides,
  useSetLibraryItemEnabled,
} from '@avl/sdk'
import { AssetCard } from './AssetCard'
import { CloudUploadButton } from './CloudUploadButton'
import { SeedCatalogCard } from './SeedCatalogCard'
import { buildCatalog, filterCatalog, type MediaTab } from './catalogItems'
import { adminStyles as s } from './adminStyles'
import type { CommunityAsset } from './types'

const ui: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.625rem', justifyContent: 'space-between' },
  toolbarLeft: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 200px', maxWidth: '320px',
    height: 34, padding: '0 0.75rem', borderRadius: 'var(--radius-md)',
    background: 'var(--white-6)', border: '1px solid var(--border-base)', color: 'var(--text-muted)',
  },
  searchInput: { flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: '0.825rem', color: 'var(--text-secondary)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' },
}

const TAB_META: Record<MediaTab, { title: string; hint: string; accept?: string }> = {
  image: {
    title: 'Images',
    hint: 'Seed images ship with the app. Upload new images to cloud storage.',
    accept: 'image/*',
  },
  video: {
    title: 'Videos',
    hint: 'Seed videos ship with the app. Upload new videos to cloud storage.',
    accept: 'video/*',
  },
  fx: {
    title: 'FX',
    hint: 'Seed animations and effects from the bundled library. Disable to hide from the layer browser.',
  },
}

type Props = { tab: MediaTab }

export function MediaTypePanel({ tab }: Props) {
  const { data: assetsData, isLoading: loadingCloud } = useCommunityAssets()
  const { data: overridesData, isLoading: loadingOverrides } = useLibraryOverrides()
  const updateAsset = useUpdateCommunityAsset()
  const deleteAsset = useDeleteCommunityAsset()
  const setEnabled = useSetLibraryItemEnabled()

  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const cloudAssets: CommunityAsset[] = (assetsData?.data as CommunityAsset[]) ?? []
  const disabled = new Set(overridesData?.data ?? [])
  const meta = TAB_META[tab]

  const items = useMemo(
    () => filterCatalog(buildCatalog(tab, cloudAssets), query),
    [tab, cloudAssets, query],
  )

  const enabledSeedCount = items.filter(
    (i) => i.source === 'seed' && !disabled.has(i.itemKey),
  ).length
  const seedCount = items.filter((i) => i.source === 'seed').length

  async function toggleSeed(itemKey: string, enabled: boolean) {
    try {
      await setEnabled.mutateAsync({ itemKey, enabled: !enabled })
      toast.success(enabled ? 'Hidden from library' : 'Enabled in library')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleTogglePublish(id: string, published: boolean) {
    try {
      await updateAsset.mutateAsync({ id, published })
      toast.success(published ? 'Published' : 'Unpublished')
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

  const isLoading = loadingCloud || loadingOverrides

  return (
    <section style={s.card}>
      <div style={ui.toolbar}>
        <div>
          <h2 style={{ ...s.sectionTitle, margin: 0 }}>{meta.title}</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {meta.hint}
            {seedCount > 0 && ` · ${enabledSeedCount}/${seedCount} seed items enabled`}
          </p>
        </div>
        {meta.accept && <CloudUploadButton accept={meta.accept} />}
      </div>

      <div style={{ ...ui.toolbar, marginTop: '1rem', marginBottom: '0.75rem' }}>
        <label style={ui.searchWrap}>
          <Search size={15} />
          <input
            style={ui.searchInput}
            value={query}
            placeholder={`Search ${meta.title.toLowerCase()}…`}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {isLoading ? (
        <div style={s.emptyText}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={s.emptyText}>No {meta.title.toLowerCase()} match your search.</div>
      ) : (
        <div style={ui.grid}>
          {items.map((item) => {
            if (item.source === 'seed') {
              const enabled = !disabled.has(item.itemKey)
              return (
                <SeedCatalogCard
                  key={item.itemKey}
                  item={item}
                  enabled={enabled}
                  pending={setEnabled.isPending}
                  onToggle={() => toggleSeed(item.itemKey, enabled)}
                />
              )
            }
            const asset = item.asset
            return (
              <AssetCard
                key={asset.id}
                asset={asset}
                locationLabel="Cloud"
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
            )
          })}
        </div>
      )}
    </section>
  )
}

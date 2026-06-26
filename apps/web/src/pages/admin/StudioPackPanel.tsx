import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { useLibraryOverrides, useSetLibraryItemEnabled, studioItemKey } from '@avl/sdk'
import { communityAssets } from '../../features/visualizer/assets/registry'
import { COMMUNITY_SECTIONS } from '../../features/visualizer/fx/fxLibrary'
import type { AssetCollection } from '../../features/visualizer/project/types'
import { adminStyles as s } from './adminStyles'

type CollectionFilter = 'all' | AssetCollection

const ui: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' },
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' },
  card: {
    borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-base)', background: 'var(--white-3)',
    padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  cardDisabled: { opacity: 0.55, borderColor: 'var(--border-subtle)' },
  thumb: {
    height: 56, borderRadius: 'var(--radius-md)', background: 'var(--purple-dim)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.1rem', fontWeight: 700, color: 'var(--purple-light)',
  },
  name: { fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-hi)', lineHeight: 1.3 },
  meta: { fontSize: '0.7rem', color: 'var(--text-muted)' },
  toggle: {
    height: 30, borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 500,
    border: '1px solid var(--border-base)', cursor: 'pointer', marginTop: 'auto',
  },
  enable: { background: 'var(--white-6)', color: 'var(--text-secondary)' },
  disable: { background: 'var(--danger-dim)', color: 'var(--danger)', borderColor: 'rgba(255,80,80,.25)' },
}

export function StudioPackPanel() {
  const { data: overridesData, isLoading } = useLibraryOverrides()
  const setEnabled = useSetLibraryItemEnabled()
  const [query, setQuery] = useState('')
  const [collection, setCollection] = useState<CollectionFilter>('all')

  const disabled = new Set(overridesData?.data ?? [])
  const pack = useMemo(
    () => communityAssets.filter((a) => a.collection !== 'uploads'),
    [],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pack.filter((a) => {
      if (collection !== 'all' && a.collection !== collection) return false
      if (!q) return true
      return [a.name, a.category, a.collection, ...(a.tags ?? [])].join(' ').toLowerCase().includes(q)
    })
  }, [pack, query, collection])

  const enabledCount = pack.filter((a) => !disabled.has(studioItemKey(a.id))).length

  async function toggle(assetId: string, currentlyEnabled: boolean) {
    const itemKey = studioItemKey(assetId)
    try {
      await setEnabled.mutateAsync({ itemKey, enabled: !currentlyEnabled })
      toast.success(currentlyEnabled ? 'Template hidden from library' : 'Template enabled')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const collections: { id: CollectionFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    ...COMMUNITY_SECTIONS.map((s) => ({ id: s.collection as CollectionFilter, label: s.label })),
  ]

  return (
    <section style={s.card}>
      <h2 style={s.sectionTitle}>Studio pack</h2>
      <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {enabledCount} of {pack.length} templates visible in the layer browser
      </p>

      <div style={ui.toolbar}>
        <label style={ui.searchWrap}>
          <Search size={15} />
          <input style={ui.searchInput} value={query} placeholder="Search templates…" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div style={ui.chipRow}>
          {collections.map(({ id, label }) => (
            <button key={id} type="button" style={{ ...ui.filterChip, ...(collection === id ? ui.filterChipActive : {}) }} onClick={() => setCollection(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={s.emptyText}>Loading…</div>
      ) : (
        <div style={ui.grid}>
          {filtered.map((asset) => {
            const enabled = !disabled.has(studioItemKey(asset.id))
            const initials = asset.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
            return (
              <article key={asset.id} style={{ ...ui.card, ...(!enabled ? ui.cardDisabled : {}) }}>
                <div style={ui.thumb}>{initials}</div>
                <span style={ui.name}>{asset.name}</span>
                <span style={ui.meta}>{asset.category} · {asset.collection}</span>
                <button
                  type="button"
                  style={{ ...ui.toggle, ...(enabled ? ui.disable : ui.enable) }}
                  disabled={setEnabled.isPending}
                  onClick={() => toggle(asset.id, enabled)}
                >
                  {enabled ? 'Disable' : 'Enable'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

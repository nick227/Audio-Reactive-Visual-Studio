import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { useLibraryOverrides, useSetLibraryItemEnabled, stockItemKey } from '@avl/sdk'
import { STOCK_IMAGES, STOCK_VIDEOS } from '../../features/visualizer/assets/stockMedia'
import { adminStyles as s } from './adminStyles'

type StockFilter = 'all' | 'images' | 'videos'

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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' },
  card: {
    borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-base)', background: 'var(--white-3)',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  cardDisabled: { opacity: 0.55 },
  thumb: { aspectRatio: '16 / 10', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thumbMedia: { width: '100%', height: '100%', objectFit: 'cover' },
  body: { padding: '0.625rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1 },
  name: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-hi)' },
  badge: { fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  toggle: {
    height: 28, borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 500,
    border: '1px solid var(--border-base)', cursor: 'pointer',
  },
  enable: { background: 'var(--white-6)', color: 'var(--text-secondary)' },
  disable: { background: 'var(--danger-dim)', color: 'var(--danger)', borderColor: 'rgba(255,80,80,.25)' },
}

export function StockMediaPanel() {
  const { data: overridesData, isLoading } = useLibraryOverrides()
  const setEnabled = useSetLibraryItemEnabled()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StockFilter>('all')

  const disabled = new Set(overridesData?.data ?? [])
  const allStock = useMemo(
    () => [
      ...STOCK_IMAGES.map((item) => ({ ...item, kind: 'image' as const })),
      ...STOCK_VIDEOS.map((item) => ({ ...item, kind: 'video' as const })),
    ],
    [],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allStock.filter((item) => {
      if (filter === 'images' && item.kind !== 'image') return false
      if (filter === 'videos' && item.kind !== 'video') return false
      if (!q) return true
      return item.name.toLowerCase().includes(q)
    })
  }, [allStock, query, filter])

  const enabledCount = allStock.filter((item) => !disabled.has(stockItemKey(item.id))).length

  async function toggle(stockId: string, currentlyEnabled: boolean) {
    try {
      await setEnabled.mutateAsync({ itemKey: stockItemKey(stockId), enabled: !currentlyEnabled })
      toast.success(currentlyEnabled ? 'Stock item hidden' : 'Stock item enabled')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  return (
    <section style={s.card}>
      <h2 style={s.sectionTitle}>Stock media</h2>
      <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {enabledCount} of {allStock.length} bundled stock files visible in Images / Videos tabs
      </p>

      <div style={ui.toolbar}>
        <label style={ui.searchWrap}>
          <Search size={15} />
          <input style={ui.searchInput} value={query} placeholder="Search stock…" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div style={ui.chipRow}>
          {(['all', 'images', 'videos'] as StockFilter[]).map((id) => (
            <button key={id} type="button" style={{ ...ui.filterChip, ...(filter === id ? ui.filterChipActive : {}) }} onClick={() => setFilter(id)}>
              {id === 'all' ? 'All' : id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={s.emptyText}>Loading…</div>
      ) : (
        <div style={ui.grid}>
          {filtered.map((item) => {
            const enabled = !disabled.has(stockItemKey(item.id))
            return (
              <article key={item.id} style={{ ...ui.card, ...(!enabled ? ui.cardDisabled : {}) }}>
                <div style={ui.thumb}>
                  {item.kind === 'image' ? (
                    <img src={item.url} alt={item.name} style={ui.thumbMedia} />
                  ) : (
                    <video src={item.url} muted playsInline preload="metadata" style={ui.thumbMedia} />
                  )}
                </div>
                <div style={ui.body}>
                  <span style={ui.name}>{item.name}</span>
                  <span style={ui.badge}>{item.kind}</span>
                  <button
                    type="button"
                    style={{ ...ui.toggle, ...(enabled ? ui.disable : ui.enable) }}
                    disabled={setEnabled.isPending}
                    onClick={() => toggle(item.id, enabled)}
                  >
                    {enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

import type { SeedFxItem, SeedImageItem, SeedVideoItem } from './catalogItems'

type Props = {
  item: SeedImageItem | SeedVideoItem | SeedFxItem
  enabled: boolean
  pending: boolean
  onToggle: () => void
}

const card: Record<string, React.CSSProperties> = {
  root: {
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-base)',
    background: 'var(--white-3)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  rootDisabled: { opacity: 0.55 },
  thumb: {
    aspectRatio: '16 / 10',
    background: '#111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFx: {
    aspectRatio: '16 / 10',
    background: 'var(--purple-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--purple-light)',
  },
  media: { width: '100%', height: '100%', objectFit: 'cover' },
  body: { padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1 },
  name: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-hi)', lineHeight: 1.3 },
  meta: { fontSize: '0.7rem', color: 'var(--text-muted)' },
  actions: { padding: '0.625rem 0.875rem', borderTop: '1px solid var(--border-faint)' },
  btn: {
    width: '100%',
    height: 30,
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: 500,
    border: '1px solid var(--border-base)',
    cursor: 'pointer',
  },
  enable: { background: 'var(--white-6)', color: 'var(--text-secondary)' },
  disable: { background: 'var(--danger-dim)', color: 'var(--danger)', borderColor: 'rgba(255,80,80,.25)' },
}

export function SeedCatalogCard({ item, enabled, pending, onToggle }: Props) {
  const kindLabel = item.kind === 'fx' ? 'FX' : item.kind === 'image' ? 'Image' : 'Video'

  return (
    <article style={{ ...card.root, ...(!enabled ? card.rootDisabled : {}) }}>
      {item.kind === 'fx' ? (
        <div style={card.thumbFx}>
          {item.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
        </div>
      ) : (
        <div style={card.thumb}>
          {item.kind === 'image' ? (
            <img src={item.previewUrl} alt={item.name} style={card.media} />
          ) : (
            <video src={item.previewUrl} muted playsInline preload="metadata" style={card.media} />
          )}
        </div>
      )}
      <div style={card.body}>
        <span style={card.name}>{item.name}</span>
        <span style={card.meta}>
          {kindLabel} · Seed
          {item.kind === 'fx' ? ` · ${item.category}` : ''}
        </span>
      </div>
      <div style={card.actions}>
        <button
          type="button"
          style={{ ...card.btn, ...(enabled ? card.disable : card.enable) }}
          disabled={pending}
          onClick={onToggle}
        >
          {enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </article>
  )
}

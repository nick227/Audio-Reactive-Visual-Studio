import { useState } from 'react'
import { adminStyles as s } from './adminStyles'
import { MediaTypePanel } from './MediaTypePanel'
import type { MediaTab } from './catalogItems'

const sectionTab: React.CSSProperties = {
  height: 32,
  padding: '0 0.875rem',
  borderRadius: 'var(--radius-full)',
  fontSize: '0.775rem',
  fontWeight: 500,
  background: 'var(--white-4)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
}

const sectionTabActive: React.CSSProperties = {
  background: 'var(--purple-dim)',
  borderColor: 'var(--purple-border)',
  color: 'var(--purple-light)',
}

const TABS: { id: MediaTab; label: string }[] = [
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'fx', label: 'FX' },
]

export function AdminAssetsDashboard() {
  const [tab, setTab] = useState<MediaTab>('image')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <section style={s.card}>
        <h2 style={{ ...s.sectionTitle, marginBottom: '0.5rem' }}>Asset management</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Browse and manage media by type — image, video, or FX animation. Seed items ship with the app;
          cloud uploads are stored in R2. Location is shown on each card. Disable items to hide them from the layer browser.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              style={{ ...sectionTab, ...(tab === id ? sectionTabActive : {}) }}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <MediaTypePanel tab={tab} />
    </div>
  )
}

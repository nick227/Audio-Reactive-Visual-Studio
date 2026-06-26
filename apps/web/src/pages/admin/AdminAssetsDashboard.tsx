import { useMemo, useState } from 'react'
import { communityAssets } from '../../features/visualizer/assets/registry'
import { COMMUNITY_SECTIONS } from '../../features/visualizer/fx/fxLibrary'
import { adminStyles as s } from './adminStyles'
import { CloudLibraryPanel } from './CloudLibraryPanel'
import { StudioPackPanel } from './StudioPackPanel'
import { StockMediaPanel } from './StockMediaPanel'

type AssetSection = 'cloud' | 'studio' | 'stock'

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

export function AdminAssetsDashboard() {
  const [section, setSection] = useState<AssetSection>('cloud')

  const studioCount = useMemo(
    () => communityAssets.filter((a) => a.collection !== 'uploads').length,
    [],
  )

  const sections: { id: AssetSection; label: string }[] = [
    { id: 'cloud', label: 'Cloud' },
    { id: 'studio', label: `Studio (${studioCount})` },
    { id: 'stock', label: 'Stock' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <section style={s.card}>
        <h2 style={{ ...s.sectionTitle, marginBottom: '0.5rem' }}>Asset management</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Cloud uploads are stored in R2 (or local dev storage). The studio pack is {studioCount} bundled
          templates across {COMMUNITY_SECTIONS.length} collections. Stock media are bundled image/video files.
          Disable items to hide them from the layer browser.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {sections.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              style={{ ...sectionTab, ...(section === id ? sectionTabActive : {}) }}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {section === 'cloud' && <CloudLibraryPanel />}
      {section === 'studio' && <StudioPackPanel />}
      {section === 'stock' && <StockMediaPanel />}
    </div>
  )
}

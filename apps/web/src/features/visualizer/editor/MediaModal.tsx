import { useMemo, useRef, useState } from 'react'
import { Search, Upload, X } from 'lucide-react'
import { useLibraryConfig, stockItemKey } from '@avl/sdk'
import { getLayerCatalogItems, filterByLayerType, LAYER_TYPE_FILTERS, type FxItem, type LayerTypeFilter } from '../fx/fxLibrary'
import { STOCK_IMAGES, STOCK_VIDEOS } from '../assets/stockMedia'
import { PuppetThumbnail } from './PuppetThumbnail'

export type UploadRecord = { id: string; name: string; url: string; fileKey: string }

type MediaItem = UploadRecord & { kind: 'image' | 'video'; stock?: boolean; cloud?: boolean }

type Props = {
  onClose: () => void
  onAddTemplate: (templateId: string) => void
  onUploadImage: (file: File) => void
  onUploadVideo: (file: File) => void
  uploadedImages: UploadRecord[]
  uploadedVideos: UploadRecord[]
  onReuseImage: (url: string, name: string, fileKey: string) => void
  onReuseVideo: (url: string, name: string, fileKey: string) => void
}

export function MediaModal({
  onClose, onAddTemplate, onUploadImage, onUploadVideo,
  uploadedImages, uploadedVideos, onReuseImage, onReuseVideo,
}: Props) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<LayerTypeFilter>('mine')
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: libraryConfig } = useLibraryConfig()
  const disabledKeys = libraryConfig?.disabledKeys

  const catalogItems = useMemo(
    () => filterByLayerType(getLayerCatalogItems(query, disabledKeys), typeFilter),
    [query, typeFilter, disabledKeys],
  )

  const imageItems = useMemo((): MediaItem[] => {
    if (typeFilter !== 'mine' && typeFilter !== 'images') return []
    const q = query.trim().toLowerCase()
    if (typeFilter === 'mine') {
      const items: MediaItem[] = uploadedImages.map((item) => ({ ...item, kind: 'image' as const }))
      return q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items
    }
    const stock = STOCK_IMAGES
      .filter((item) => !disabledKeys?.includes(stockItemKey(item.id)))
      .map((item) => ({ ...item, kind: 'image' as const, stock: true }))
    const cloud = (libraryConfig?.cloudAssets ?? [])
      .filter((a) => a.kind === 'image')
      .map((a) => ({
        id: `cloud-${a.id}`,
        name: a.title,
        url: a.publicUrl,
        fileKey: `cloud:${a.id}`,
        kind: 'image' as const,
        cloud: true,
      }))
    const items = [...stock, ...cloud]
    return q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items
  }, [query, typeFilter, uploadedImages, disabledKeys, libraryConfig?.cloudAssets])

  const videoItems = useMemo((): MediaItem[] => {
    if (typeFilter !== 'mine' && typeFilter !== 'videos') return []
    const q = query.trim().toLowerCase()
    if (typeFilter === 'mine') {
      const items: MediaItem[] = uploadedVideos.map((item) => ({ ...item, kind: 'video' as const }))
      return q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items
    }
    const stock = STOCK_VIDEOS
      .filter((item) => !disabledKeys?.includes(stockItemKey(item.id)))
      .map((item) => ({ ...item, kind: 'video' as const, stock: true }))
    const cloud = (libraryConfig?.cloudAssets ?? [])
      .filter((a) => a.kind === 'video')
      .map((a) => ({
        id: `cloud-${a.id}`,
        name: a.title,
        url: a.publicUrl,
        fileKey: `cloud:${a.id}`,
        kind: 'video' as const,
        cloud: true,
      }))
    const items = [...stock, ...cloud]
    return q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items
  }, [query, typeFilter, uploadedVideos, disabledKeys, libraryConfig?.cloudAssets])

  const mediaItems = useMemo(() => [...imageItems, ...videoItems], [imageItems, videoItems])

  const hasResults = mediaItems.length > 0 || catalogItems.length > 0

  const handleUpload = (file: File) => {
    if (file.type.startsWith('video/')) onUploadVideo(file)
    else onUploadImage(file)
  }

  return (
    <div className="modal-backdrop">
      <div className="media-modal fx-browser-modal layer-browser-modal">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
            e.target.value = ''
          }}
        />

        <header className="layer-browser-header">
          <h2>Add Layer</h2>
          <label className="fx-search">
            <Search size={15} />
            <input
              value={query}
              placeholder="Search layers…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="layer-browser-upload-btn"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} />
            Upload
          </button>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="layer-browser-chips fx-tab-strip" role="tablist" aria-label="Filter layers by type">
          {LAYER_TYPE_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={typeFilter === id}
              className={typeFilter === id ? 'active' : ''}
              onClick={() => setTypeFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="media-body layer-browser-body">
          {hasResults ? (
            <div className="layer-browser-grid">
              {mediaItems.map((item) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  className="media-card"
                  title={item.name}
                  onClick={() => (
                    item.kind === 'image'
                      ? onReuseImage(item.url, item.name, item.fileKey)
                      : onReuseVideo(item.url, item.name, item.fileKey)
                  )}
                >
                  <div className="media-card-thumb">
                    {item.kind === 'image' ? (
                      <img src={item.url} alt={item.name} />
                    ) : (
                      <video
                        src={item.url}
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1 }}
                      />
                    )}
                    {item.kind === 'video' && <span className="media-card-badge">Video</span>}
                    {item.stock && <span className="media-card-badge media-card-badge--stock">Stock</span>}
                    {item.cloud && <span className="media-card-badge media-card-badge--stock">Cloud</span>}
                  </div>
                  <div className="media-card-name">{item.name}</div>
                </button>
              ))}
              {catalogItems.map((item) => (
                <FxCard key={item.id} item={item} onAdd={onAddTemplate} />
              ))}
            </div>
          ) : (
            <div className="media-empty-state">
              {typeFilter === 'mine' && !query.trim()
                ? 'No uploads yet — use Upload to add images or videos.'
                : typeFilter === 'images' && !query.trim()
                  ? 'No stock images match this search.'
                  : typeFilter === 'videos' && !query.trim()
                    ? 'No stock videos match this search.'
                    : 'No layers match this filter.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FxCard({ item, onAdd }: { item: FxItem; onAdd: (templateId: string) => void }) {
  return (
    <button type="button" className="media-card" onClick={() => onAdd(item.add.templateId)}>
      <div className="media-card-thumb">
        <AssetThumbnail settings={item.settings} />
      </div>
      <div className="media-card-name">{item.title}</div>
    </button>
  )
}

function AssetThumbnail({ settings }: { settings: Record<string, unknown> }) {
  const visualKind = String(settings.visualKind ?? '')
  const color = String(settings.color ?? '#ffffff')

  switch (visualKind) {
    case 'gradient':
      return (
        <div
          className="layer-box studio-gradient thumb-asset"
          style={{
            ['--a' as string]: String(settings.colorA ?? '#5b4bff'),
            ['--b' as string]: String(settings.colorB ?? '#ff4fd8'),
            ['--c' as string]: String(settings.colorC ?? '#00e0ff'),
          }}
        />
      )
    case 'texture':
      return <div className={`layer-box studio-texture texture-${settings.textureKind ?? 'grain'} thumb-asset`} style={{ color }} />
    case 'particles': {
      const kind = String(settings.particleKind ?? 'sparkles')
      return (
        <div className={`layer-box studio-particles particles-${kind} thumb-asset`} style={{ color }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <b key={i} style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 7) * -0.3}s`,
              ['--s' as string]: `${3 + (i % 4)}px`,
            }} />
          ))}
        </div>
      )
    }
    case 'audioVisualizer': {
      const kind = String(settings.visualizerKind ?? 'bars')
      const count = (kind === 'rings' || kind === 'halo') ? 4 : kind === 'radial' ? 24 : 20
      return (
        <div className={`layer-box studio-visualizer visualizer-${kind} thumb-asset`} style={{ color }}>
          {Array.from({ length: count }).map((_, i) => (
            <i key={i} style={{
              ['--h' as string]: `${spectrumHeight(kind, i, count)}%`,
              ['--i' as string]: String(Math.round((i / count) * 360)),
            }} />
          ))}
        </div>
      )
    }
    case 'threeObject':
      return (
        <div className={`layer-box studio-object object-${settings.objectKind ?? 'orb'} thumb-asset`} style={{ color }}>
          <span /><i />
        </div>
      )
    case 'typography': {
      const typeKind = String(settings.typeKind ?? 'block')
      const text = String(settings.text ?? 'TEXT')
      return (
        <div className="thumb-asset thumb-type-outer">
          <div className={`studio-type type-${typeKind}`} style={{ color, fontSize: 18, minWidth: 0, padding: '4px 8px' }}>
            {text.split(' ').slice(0, 2).join(' ')}
          </div>
        </div>
      )
    }
    case 'frame':
      return (
        <div className={`layer-box studio-frame frame-${settings.frameKind ?? 'chrome'} thumb-asset`} style={{ color }}>
          <span />
        </div>
      )
    case 'motionEffect':
      return (
        <div className={`layer-box studio-motion motion-${settings.effectKind ?? 'glitch'} thumb-asset`} style={{ color }}>
          <span />
        </div>
      )
    case 'puppet':
      return (
        <div className="thumb-asset thumb-puppet-live">
          <PuppetThumbnail characterId={String(settings.characterId ?? 'char-dancer')} />
        </div>
      )
    default:
      return null
  }
}

function spectrumHeight(kind: string, i: number, count: number): number {
  const x = i / count
  if (kind === 'bars') {
    return Math.round(Math.max(4, 10 + 75 * Math.exp(-((x - 0.18) ** 2) / 0.05) + 35 * Math.exp(-((x - 0.58) ** 2) / 0.1) + (i % 3) * 3))
  }
  return Math.round(12 + 60 * (0.5 + 0.5 * Math.sin(x * Math.PI * 3 + 0.5)) + (i % 3) * 4)
}

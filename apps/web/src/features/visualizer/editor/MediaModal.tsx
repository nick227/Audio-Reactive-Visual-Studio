import { useMemo, useRef, useState } from 'react'
import { Search, Upload, X } from 'lucide-react'
import { useLibraryConfig, seedMediaItemKey } from '@avl/sdk'
import { getLayerCatalogItems, filterByLayerType, LAYER_TYPE_FILTERS, type FxItem, type LayerTypeFilter } from '../fx/fxLibrary'
import { STOCK_IMAGES, STOCK_VIDEOS } from '../assets/stockMedia'
import { AssetThumbnail } from './AssetThumbnail'

export type UploadRecord = { id: string; name: string; url: string; fileKey: string }

type MediaItem = UploadRecord & { kind: 'image' | 'video'; seed?: boolean; cloud?: boolean }

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
    const seed = STOCK_IMAGES
      .filter((item) => !disabledKeys?.includes(seedMediaItemKey(item.id)))
      .map((item) => ({ ...item, kind: 'image' as const, seed: true }))
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
    const items = [...seed, ...cloud]
    return q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items
  }, [query, typeFilter, uploadedImages, disabledKeys, libraryConfig?.cloudAssets])

  const videoItems = useMemo((): MediaItem[] => {
    if (typeFilter !== 'mine' && typeFilter !== 'videos') return []
    const q = query.trim().toLowerCase()
    if (typeFilter === 'mine') {
      const items: MediaItem[] = uploadedVideos.map((item) => ({ ...item, kind: 'video' as const }))
      return q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items
    }
    const seed = STOCK_VIDEOS
      .filter((item) => !disabledKeys?.includes(seedMediaItemKey(item.id)))
      .map((item) => ({ ...item, kind: 'video' as const, seed: true }))
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
    const items = [...seed, ...cloud]
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
                    {item.seed && <span className="media-card-badge media-card-badge--stock">Seed</span>}
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
                  ? 'No seed images match this search.'
                  : typeFilter === 'videos' && !query.trim()
                    ? 'No seed videos match this search.'
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

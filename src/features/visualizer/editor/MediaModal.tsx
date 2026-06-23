import { useMemo, useRef, useState } from 'react'
import { Music, Search, Upload, X } from 'lucide-react'
import { filterCommunityItems, fxTabs, getItemsBySection, puppetItems, textItems, type FxItem, type FxTabId } from '../fx/fxLibrary'
import { PuppetThumbnail } from './PuppetThumbnail'

export type UploadRecord = { id: string; name: string; url: string; fileKey: string }

type AudioTrackInfo = { name: string; url: string; duration: number }

type MineSection =
  | { label: string; kind: 'images'; items: UploadRecord[]; onUpload: () => void }
  | { label: string; kind: 'audio'; items: AudioTrackInfo[]; onUpload: () => void }
  | { label: string; kind: 'videos'; items: UploadRecord[]; onUpload: () => void }

type Props = {
  onClose: () => void
  onAddTemplate: (templateId: string) => void
  onUploadImage: (file: File) => void
  onUploadAudio: (file: File) => void
  onUploadVideo: (file: File) => void
  uploadedImages: UploadRecord[]
  uploadedVideos: UploadRecord[]
  audioTrack: AudioTrackInfo | null
  onReuseImage: (url: string, name: string, fileKey: string) => void
  onReuseVideo: (url: string, name: string, fileKey: string) => void
}

export function MediaModal({
  onClose, onAddTemplate, onUploadImage, onUploadAudio, onUploadVideo,
  uploadedImages, uploadedVideos, audioTrack, onReuseImage, onReuseVideo,
}: Props) {
  const [activeTab, setActiveTab] = useState<FxTabId>('mine')
  const [query, setQuery] = useState('')
  const imageRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  const communityItems = useMemo(() => filterCommunityItems(query), [query])
  const communitySections = useMemo(() => getItemsBySection(communityItems), [communityItems])

  const mineSections = useMemo((): MineSection[] => {
    const q = query.trim().toLowerCase()
    const filterByName = <T extends { name: string }>(arr: T[]) =>
      q ? arr.filter((i) => i.name.toLowerCase().includes(q)) : arr
    return [
      { label: 'Images', kind: 'images', items: filterByName(uploadedImages), onUpload: () => imageRef.current?.click() },
      { label: 'Audio', kind: 'audio', items: filterByName(audioTrack ? [audioTrack] : []), onUpload: () => audioRef.current?.click() },
      { label: 'Videos', kind: 'videos', items: filterByName(uploadedVideos), onUpload: () => videoRef.current?.click() },
    ]
  }, [query, uploadedImages, uploadedVideos, audioTrack])

  return (
    <div className="modal-backdrop">
      <div className="media-modal fx-browser-modal">
        <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadImage(f); e.target.value = '' }} />
        <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadAudio(f); e.target.value = '' }} />
        <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadVideo(f); e.target.value = '' }} />

        <div className="fx-browser-tools">
          <div className="modal-tab-strip">
            {fxTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`modal-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setQuery('') }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label className="fx-search">
            <Search size={15} />
            <input
              value={query}
              placeholder={activeTab === 'mine' ? 'Search your media…' : 'Search FX…'}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="media-body">
          {activeTab === 'mine' && mineSections.map((section) => (
            <div key={section.label} className="media-section">
              <div className="media-section-header">
                <span>{section.label}</span>
                <button type="button" className="media-upload-btn" onClick={section.onUpload}>
                  <Upload size={12} /> Upload
                </button>
              </div>
              <div className="media-section-grid">
                {section.kind === 'images' && section.items.map((img) => (
                  <button key={img.id} type="button" className="media-card" title={img.name}
                    onClick={() => onReuseImage(img.url, img.name, img.fileKey)}>
                    <div className="media-card-thumb"><img src={img.url} alt={img.name} /></div>
                    <div className="media-card-name">{img.name}</div>
                  </button>
                ))}
                {section.kind === 'audio' && section.items.map((track) => (
                  <div key={track.name} className="media-card active">
                    <div className="media-card-thumb media-card-thumb-audio"><Music size={28} /></div>
                    <div className="media-card-name">{track.name}</div>
                    {track.duration > 0 && <div className="media-card-meta">{formatDuration(track.duration)}</div>}
                  </div>
                ))}
                {section.kind === 'videos' && section.items.map((vid) => (
                  <button key={vid.id} type="button" className="media-card" title={vid.name}
                    onClick={() => onReuseVideo(vid.url, vid.name, vid.fileKey)}>
                    <div className="media-card-thumb">
                      <video
                        src={vid.url}
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1 }}
                      />
                    </div>
                    <div className="media-card-name">{vid.name}</div>
                  </button>
                ))}
                {section.items.length === 0 && (
                  <div className="media-empty">No {section.label.toLowerCase()} yet</div>
                )}
              </div>
            </div>
          ))}

          {activeTab === 'text' && (
            <div className="media-section">
              <div className="media-section-header"><span>Text Styles</span></div>
              <div className="media-section-grid">
                {textItems.map((item) => <FxCard key={item.id} item={item} onAdd={onAddTemplate} />)}
              </div>
            </div>
          )}

          {activeTab === 'puppets' && (
            <div className="media-section">
              <div className="media-section-header"><span>Puppet Dancers</span></div>
              <div className="media-section-grid">
                {puppetItems.map((item) => <FxCard key={item.id} item={item} onAdd={onAddTemplate} />)}
              </div>
            </div>
          )}

          {activeTab === 'community' && communitySections.map(({ section, items }) => (
            <div key={section.collection} className="media-section">
              <div className="media-section-header"><span>{section.label}</span></div>
              <div className="media-section-grid">
                {items.map((item) => <FxCard key={item.id} item={item} onAdd={onAddTemplate} />)}
                {items.length === 0 && <div className="media-empty">No results</div>}
              </div>
            </div>
          ))}

          {activeTab === 'community' && communitySections.length === 0 && (
            <div className="media-empty-state">No FX match this search.</div>
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

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

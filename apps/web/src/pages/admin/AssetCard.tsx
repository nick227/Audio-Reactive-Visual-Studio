import { Check, File, Image, Music, Pencil, Trash2, Video, X } from 'lucide-react'
import { getCommunityMediaUrl } from '../../lib/mediaUrls'
import { formatBytes, formatDate, mimeCategory, type MimeCategory } from './assetUtils'
import type { CommunityAsset } from './types'

export type AssetCardProps = {
  asset: CommunityAsset
  locationLabel?: string
  editing: boolean
  editTitle: string
  confirmDelete: boolean
  pending: boolean
  onStartEdit: () => void
  onEditTitle: (v: string) => void
  onSaveTitle: () => void
  onCancelEdit: () => void
  onTogglePublish: () => void
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}

const MIME_ICONS: Record<MimeCategory, typeof Image> = {
  image: Image,
  video: Video,
  audio: Music,
  other: File,
}

const MIME_GRADIENTS: Record<MimeCategory, string> = {
  image: 'linear-gradient(135deg, rgba(88,120,255,.22), rgba(120,88,255,.12))',
  video: 'linear-gradient(135deg, rgba(255,88,160,.22), rgba(120,88,255,.12))',
  audio: 'linear-gradient(135deg, rgba(88,255,180,.18), rgba(88,120,255,.12))',
  other: 'linear-gradient(135deg, rgba(160,160,180,.15), rgba(120,88,255,.08))',
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
  thumb: {
    position: 'relative',
    aspectRatio: '16 / 10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  badgePublished: {
    background: 'rgba(40,180,100,.2)',
    color: 'var(--success)',
    border: '1px solid rgba(40,180,100,.3)',
  },
  badgeDraft: {
    background: 'rgba(255,180,60,.15)',
    color: 'var(--warn)',
    border: '1px solid rgba(255,180,60,.25)',
  },
  body: {
    padding: '0.75rem 0.875rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    flex: 1,
  },
  titleRow: { display: 'flex', alignItems: 'flex-start', gap: '0.375rem' },
  title: {
    flex: 1,
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-hi)',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  titleInput: {
    flex: 1,
    height: 28,
    padding: '0 0.5rem',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--white-8)',
    border: '1px solid var(--border-base)',
    color: 'var(--text-secondary)',
    fontSize: '0.825rem',
    outline: 'none',
  },
  iconBtn: {
    width: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--white-6)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  filename: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    display: 'flex',
    gap: '0.5rem',
    fontSize: '0.7rem',
    color: 'var(--text-ghost)',
    marginTop: 'auto',
  },
  actions: {
    display: 'flex',
    gap: '0.375rem',
    padding: '0.625rem 0.875rem',
    borderTop: '1px solid var(--border-faint)',
  },
  actionBtn: {
    flex: 1,
    height: 30,
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: 500,
    border: '1px solid var(--border-base)',
    cursor: 'pointer',
  },
  publishBtn: { background: 'var(--white-6)', color: 'var(--text-secondary)' },
  deleteBtn: {
    background: 'var(--danger-dim)',
    color: 'var(--danger)',
    borderColor: 'rgba(255,80,80,.25)',
    flex: '0 0 auto',
    width: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
}

export function AssetCard({
  asset, locationLabel, editing, editTitle, confirmDelete, pending,
  onStartEdit, onEditTitle, onSaveTitle, onCancelEdit,
  onTogglePublish, onRequestDelete, onCancelDelete, onConfirmDelete,
}: AssetCardProps) {
  const cat = mimeCategory(asset.mimeType)
  const Icon = MIME_ICONS[cat]
  const previewUrl = getCommunityMediaUrl(asset.fileKey)
  const hasPreview = cat === 'image' || cat === 'video'

  return (
    <article style={card.root}>
      <div style={{ ...card.thumb, background: hasPreview ? '#111' : MIME_GRADIENTS[cat] }}>
        {hasPreview ? (
          cat === 'image' ? (
            <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <video src={previewUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        ) : (
          <Icon size={32} strokeWidth={1.5} />
        )}
        <span style={{ ...card.badge, ...(asset.published ? card.badgePublished : card.badgeDraft) }}>
          {asset.published ? 'Live' : 'Draft'}
        </span>
      </div>

      <div style={card.body}>
        <div style={card.titleRow}>
          {editing ? (
            <>
              <input
                style={card.titleInput}
                value={editTitle}
                onChange={(e) => onEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveTitle()
                  if (e.key === 'Escape') onCancelEdit()
                }}
                autoFocus
              />
              <button type="button" style={card.iconBtn} onClick={onSaveTitle} disabled={pending}>
                <Check size={13} />
              </button>
              <button type="button" style={card.iconBtn} onClick={onCancelEdit}>
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <span style={card.title} title={asset.title ?? asset.filename}>
                {asset.title ?? asset.filename}
              </span>
              <button type="button" style={card.iconBtn} onClick={onStartEdit} aria-label="Edit title">
                <Pencil size={12} />
              </button>
            </>
          )}
        </div>
        {asset.title && <span style={card.filename}>{asset.filename}</span>}
        <div style={card.meta}>
          {locationLabel && (
            <>
              <span>{locationLabel}</span>
              <span>·</span>
            </>
          )}
          <span>{asset.mimeType.split('/')[1] ?? asset.mimeType}</span>
          <span>·</span>
          <span>{formatBytes(asset.sizeBytes)}</span>
          <span>·</span>
          <span>{formatDate(asset.createdAt)}</span>
        </div>
      </div>

      <div style={card.actions}>
        {confirmDelete ? (
          <>
            <button
              type="button"
              style={{ ...card.actionBtn, ...card.deleteBtn, flex: 1, width: 'auto' }}
              onClick={onConfirmDelete}
              disabled={pending}
            >
              Confirm delete
            </button>
            <button type="button" style={{ ...card.actionBtn, ...card.publishBtn }} onClick={onCancelDelete}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              style={{ ...card.actionBtn, ...card.publishBtn }}
              onClick={onTogglePublish}
              disabled={pending}
            >
              {asset.published ? 'Unpublish' : 'Publish'}
            </button>
            <button
              type="button"
              style={{ ...card.actionBtn, ...card.deleteBtn }}
              onClick={onRequestDelete}
              disabled={pending}
              aria-label="Delete asset"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </article>
  )
}

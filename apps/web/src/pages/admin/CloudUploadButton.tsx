import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useUploadCommunityAsset } from '@avl/sdk'

const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  height: 34,
  padding: '0 0.875rem',
  borderRadius: 'var(--radius-md)',
  background: 'var(--purple)',
  color: '#fff',
  fontSize: '0.8rem',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
}

type Props = { accept?: string }

export function CloudUploadButton({ accept = 'image/*,video/*,audio/*' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const upload = useUploadCommunityAsset()

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    try {
      await upload.mutateAsync(file)
      toast.success('Uploaded')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        style={{ ...btn, opacity: upload.isPending ? 0.7 : 1 }}
        disabled={upload.isPending}
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={14} />
        {upload.isPending ? 'Uploading…' : 'Upload'}
      </button>
    </>
  )
}

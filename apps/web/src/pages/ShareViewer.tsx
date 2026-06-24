import { useParams } from 'react-router-dom'
import { useSharedProject } from '@avl/sdk'

export function ShareViewer() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const { data, isLoading, isError } = useSharedProject(shareToken ?? '')

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <p>Loading project…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <p>This link is no longer active or the project was unpublished.</p>
      </div>
    )
  }

  // Phase 2: render a read-only VisualizerEditor pre-loaded with data.documentJson.
  // For now, display metadata so the route is functional.
  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.title}</h1>
      <p style={{ color: '#888', fontSize: '0.875rem' }}>
        Shared project — read-only playback coming in Phase 2.
      </p>
      <pre style={{ fontSize: '0.75rem', background: '#111', padding: '1rem', borderRadius: '6px', overflow: 'auto', maxHeight: '60vh' }}>
        {JSON.stringify(data.documentJson, null, 2)}
      </pre>
    </div>
  )
}

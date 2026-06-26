import { useCallback, useEffect, useRef } from 'react'

export function useManagedObjectUrls() {
  const managedObjectUrlsRef = useRef(new Map<string, number>())
  const activeAudioObjectUrlRef = useRef<string | null>(null)

  const registerObjectUrl = useCallback((url: string) => {
    if (url.startsWith('blob:')) {
      managedObjectUrlsRef.current.set(url, (managedObjectUrlsRef.current.get(url) ?? 0) + 1)
    }
    return url
  }, [])

  const revokeManagedObjectUrl = useCallback((url: unknown) => {
    if (typeof url !== 'string' || !url.startsWith('blob:')) return
    const count = managedObjectUrlsRef.current.get(url) ?? 0
    if (count <= 1) {
      URL.revokeObjectURL(url)
      managedObjectUrlsRef.current.delete(url)
      if (activeAudioObjectUrlRef.current === url) activeAudioObjectUrlRef.current = null
    } else {
      managedObjectUrlsRef.current.set(url, count - 1)
    }
  }, [])

  const revokeAllObjectUrls = useCallback(() => {
    for (const url of managedObjectUrlsRef.current.keys()) URL.revokeObjectURL(url)
    managedObjectUrlsRef.current.clear()
    activeAudioObjectUrlRef.current = null
  }, [])

  useEffect(() => revokeAllObjectUrls, [revokeAllObjectUrls])

  return {
    managedObjectUrlsRef,
    activeAudioObjectUrlRef,
    registerObjectUrl,
    revokeManagedObjectUrl,
    revokeAllObjectUrls,
  }
}

import { useState, useEffect } from 'react'
import { getImageObjectUrl } from '../../db/images'
import { ImageOff, ZoomIn } from 'lucide-react'

interface Props {
  imageId: string
  caption?: string
  displayWidth?: number
  onLightbox?: (url: string) => void
}

export function ImageSegmentViewer({ imageId, caption, displayWidth = 100, onLightbox }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    getImageObjectUrl(imageId).then(u => {
      if (cancelled) return
      if (u) setUrl(u)
      else setError(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [imageId])

  if (loading) {
    return (
      <div className="h-20 rounded-lg bg-[var(--bg-elevated)] animate-shimmer" style={{ width: `${displayWidth}%` }} />
    )
  }

  if (error || !url) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs" style={{ width: `${displayWidth}%` }}>
        <ImageOff size={14} />
        Image not found ({imageId.slice(0, 8)}…)
      </div>
    )
  }

  return (
    <div className="group relative" style={{ width: `${displayWidth}%` }}>
      <img
        src={url}
        alt={caption || 'Question image'}
        className="rounded-lg border border-[var(--border)] max-w-full object-contain cursor-zoom-in"
        onClick={() => onLightbox?.(url)}
      />
      {onLightbox && (
        <button
          onClick={() => onLightbox(url)}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ZoomIn size={14} />
        </button>
      )}
      {caption && (
        <p className="mt-1 text-xs text-[var(--text-muted)] italic text-center">{caption}</p>
      )}
    </div>
  )
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
export function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <img
        src={url}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
        alt="Lightbox"
      />
    </div>
  )
}

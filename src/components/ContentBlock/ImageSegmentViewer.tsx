import { useState, useEffect } from 'react'
import { getImageObjectUrl } from '../../db/images'
import { ImageOff, ZoomIn, Crop as CropIcon, Maximize2 } from 'lucide-react'
import type { ImageCrop } from '../../types'

interface Props {
  imageId: string
  caption?: string
  displayWidth?: number
  crop?: ImageCrop
  onLightbox?: (url: string) => void
}

export function ImageSegmentViewer({ imageId, caption, displayWidth = 100, crop, onLightbox }: Props) {
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

  const isCropped =
    crop &&
    (crop.x > 0 || crop.y > 0 || crop.width < 99.9 || crop.height < 99.9) &&
    crop.width > 0 &&
    crop.height > 0

  return (
    <div className="group relative" style={{ width: `${displayWidth}%` }}>
      {isCropped ? (
        <div
          className="relative overflow-hidden rounded-lg border border-[var(--border)] max-w-full cursor-zoom-in"
          style={{
            aspectRatio: `${crop.width} / ${crop.height}`,
          }}
          onClick={() => onLightbox?.(url)}
        >
          <img
            src={url}
            alt={caption || 'Question image'}
            className="absolute max-w-none select-none pointer-events-none"
            style={{
              width: `${(100 / crop.width) * 100}%`,
              height: `${(100 / crop.height) * 100}%`,
              left: `-${(crop.x / crop.width) * 100}%`,
              top: `-${(crop.y / crop.height) * 100}%`,
            }}
          />
        </div>
      ) : (
        <img
          src={url}
          alt={caption || 'Question image'}
          className="rounded-lg border border-[var(--border)] max-w-full object-contain cursor-zoom-in"
          onClick={() => onLightbox?.(url)}
        />
      )}
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
export function ImageLightbox({
  url,
  crop,
  onClose,
}: {
  url: string
  crop?: ImageCrop
  onClose: () => void
}) {
  const [showFull, setShowFull] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isCropped =
    crop &&
    (crop.x > 0 || crop.y > 0 || crop.width < 99.9 || crop.height < 99.9) &&
    crop.width > 0 &&
    crop.height > 0

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 cursor-zoom-out select-none"
      onClick={onClose}
    >
      {isCropped && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowFull(f => !f)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs backdrop-blur-md transition-colors"
          >
            {showFull ? <CropIcon size={13} /> : <Maximize2 size={13} />}
            {showFull ? 'Show Cropped View' : 'Show Full Image'}
          </button>
        </div>
      )}

      {isCropped && !showFull ? (
        <div
          className="relative overflow-hidden rounded-lg shadow-2xl max-w-full max-h-[85vh]"
          style={{
            aspectRatio: `${crop.width} / ${crop.height}`,
            width: 'min(85vw, 900px)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <img
            src={url}
            alt="Lightbox Cropped"
            className="absolute max-w-none select-none pointer-events-none"
            style={{
              width: `${(100 / crop.width) * 100}%`,
              height: `${(100 / crop.height) * 100}%`,
              left: `-${(crop.x / crop.width) * 100}%`,
              top: `-${(crop.y / crop.height) * 100}%`,
            }}
          />
        </div>
      ) : (
        <img
          src={url}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scale-in"
          onClick={e => e.stopPropagation()}
          alt="Lightbox"
        />
      )}
    </div>
  )
}

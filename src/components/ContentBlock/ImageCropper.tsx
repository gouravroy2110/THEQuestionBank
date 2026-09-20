import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getImageObjectUrl } from '../../db/images'
import type { ImageCrop } from '../../types'
import { Check, X, RotateCcw, Crop, Move } from 'lucide-react'
import { Button } from '../UI'

interface Props {
  imageId: string
  crop?: ImageCrop
  onApply: (crop: ImageCrop) => void
  onReset: () => void
  onCancel: () => void
}

type DragMode =
  | { type: 'move'; startX: number; startY: number; initial: ImageCrop }
  | { type: 'resize'; handle: string; startX: number; startY: number; initial: ImageCrop }

export function ImageCropper({ imageId, crop, onApply, onReset, onCancel }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [currentCrop, setCurrentCrop] = useState<ImageCrop>(
    crop ?? { x: 0, y: 0, width: 100, height: 100 }
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragMode | null>(null)

  useEffect(() => {
    let cancelled = false
    getImageObjectUrl(imageId).then(u => {
      if (!cancelled && u) setUrl(u)
    })
    return () => { cancelled = true }
  }, [imageId])

  const handlePointerDown = (
    e: React.PointerEvent,
    action: { type: 'move' } | { type: 'resize'; handle: string }
  ) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    if (action.type === 'move') {
      dragRef.current = {
        type: 'move',
        startX: e.clientX,
        startY: e.clientY,
        initial: { ...currentCrop },
      }
    } else {
      dragRef.current = {
        type: 'resize',
        handle: action.handle,
        startX: e.clientX,
        startY: e.clientY,
        initial: { ...currentCrop },
      }
    }
  }

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const deltaX = ((e.clientX - dragRef.current.startX) / rect.width) * 100
    const deltaY = ((e.clientY - dragRef.current.startY) / rect.height) * 100
    const init = dragRef.current.initial
    const MIN_SIZE = 5

    if (dragRef.current.type === 'move') {
      let newX = Math.max(0, Math.min(100 - init.width, init.x + deltaX))
      let newY = Math.max(0, Math.min(100 - init.height, init.y + deltaY))
      setCurrentCrop(prev => ({ ...prev, x: newX, y: newY }))
    } else {
      const handle = dragRef.current.handle
      let { x, y, width, height } = init

      // Handle West
      if (handle.includes('w')) {
        const potentialX = init.x + deltaX
        const clampedX = Math.max(0, Math.min(init.x + init.width - MIN_SIZE, potentialX))
        width = init.width + (init.x - clampedX)
        x = clampedX
      }
      // Handle East
      if (handle.includes('e')) {
        const potentialW = init.width + deltaX
        width = Math.max(MIN_SIZE, Math.min(100 - init.x, potentialW))
      }
      // Handle North
      if (handle.includes('n')) {
        const potentialY = init.y + deltaY
        const clampedY = Math.max(0, Math.min(init.y + init.height - MIN_SIZE, potentialY))
        height = init.height + (init.y - clampedY)
        y = clampedY
      }
      // Handle South
      if (handle.includes('s')) {
        const potentialH = init.height + deltaY
        height = Math.max(MIN_SIZE, Math.min(100 - init.y, potentialH))
      }

      setCurrentCrop({ x, y, width, height })
    }
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // ignore if not captured
      }
      dragRef.current = null
    }
  }, [])

  if (!url) {
    return (
      <div className="h-48 rounded-xl bg-[var(--bg-elevated)] animate-shimmer flex items-center justify-center text-xs text-[var(--text-muted)]">
        Loading image for cropping…
      </div>
    )
  }

  const isFullImage =
    Math.round(currentCrop.x) === 0 &&
    Math.round(currentCrop.y) === 0 &&
    Math.round(currentCrop.width) === 100 &&
    Math.round(currentCrop.height) === 100

  return (
    <div className="rounded-xl border border-[var(--border-bright)] bg-[var(--bg-base)] overflow-hidden shadow-xl animate-scale-in">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)] bg-[var(--bg-overlay)]">
        <div className="flex items-center gap-2">
          <Crop size={14} className="text-[var(--accent)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">Pseudo Cropper</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            (Drag edges or corners to adjust display frame — original is preserved)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onCancel}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Image Cropping Area */}
      <div className="p-4 flex flex-col items-center select-none bg-black/40">
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative max-w-full overflow-hidden rounded-lg cursor-crosshair inline-block select-none"
          style={{ touchAction: 'none' }}
        >
          {/* Full original image as backdrop */}
          <img
            src={url}
            alt="Crop area"
            className="block max-h-[420px] w-auto max-w-full object-contain pointer-events-none select-none"
            draggable={false}
          />

          {/* Draggable Crop Window */}
          <div
            className="absolute border-2 border-[var(--accent)] cursor-move transition-shadow"
            style={{
              left: `${currentCrop.x}%`,
              top: `${currentCrop.y}%`,
              width: `${currentCrop.width}%`,
              height: `${currentCrop.height}%`,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
            }}
            onPointerDown={e => handlePointerDown(e, { type: 'move' })}
          >
            {/* Rule of thirds grid lines */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-35">
              <div className="border-r border-b border-white/60" />
              <div className="border-r border-b border-white/60" />
              <div className="border-b border-white/60" />
              <div className="border-r border-b border-white/60" />
              <div className="border-r border-b border-white/60" />
              <div className="border-b border-white/60" />
              <div className="border-r border-white/60" />
              <div className="border-r border-white/60" />
              <div />
            </div>

            {/* Center Pan Indicator */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 hover:opacity-60 transition-opacity">
              <Move size={20} className="text-white drop-shadow" />
            </div>

            {/* Corner Handles */}
            <div
              className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[var(--accent)] rounded-sm cursor-nwse-resize shadow-md"
              onPointerDown={e => handlePointerDown(e, { type: 'resize', handle: 'nw' })}
            />
            <div
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[var(--accent)] rounded-sm cursor-nesw-resize shadow-md"
              onPointerDown={e => handlePointerDown(e, { type: 'resize', handle: 'ne' })}
            />
            <div
              className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[var(--accent)] rounded-sm cursor-nesw-resize shadow-md"
              onPointerDown={e => handlePointerDown(e, { type: 'resize', handle: 'sw' })}
            />
            <div
              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[var(--accent)] rounded-sm cursor-nwse-resize shadow-md"
              onPointerDown={e => handlePointerDown(e, { type: 'resize', handle: 'se' })}
            />

            {/* Edge Handles */}
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-[var(--accent)] rounded-full cursor-ns-resize shadow-sm"
              onPointerDown={e => handlePointerDown(e, { type: 'resize', handle: 'n' })}
            />
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-[var(--accent)] rounded-full cursor-ns-resize shadow-sm"
              onPointerDown={e => handlePointerDown(e, { type: 'resize', handle: 's' })}
            />
            <div
              className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 bg-white border border-[var(--accent)] rounded-full cursor-ew-resize shadow-sm"
              onPointerDown={e => handlePointerDown(e, { type: 'resize', handle: 'w' })}
            />
            <div
              className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 bg-white border border-[var(--accent)] rounded-full cursor-ew-resize shadow-sm"
              onPointerDown={e => handlePointerDown(e, { type: 'resize', handle: 'e' })}
            />
          </div>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-elevated)] border-t border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--text-muted)]">
            Frame: <span className="text-[var(--text-primary)] font-medium">{Math.round(currentCrop.width)}% × {Math.round(currentCrop.height)}%</span>
            {' '}(at {Math.round(currentCrop.x)}%, {Math.round(currentCrop.y)}%)
          </span>
          {!isFullImage && (
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw size={11} />}
              onClick={() => {
                const full: ImageCrop = { x: 0, y: 0, width: 100, height: 100 }
                setCurrentCrop(full)
                onReset()
              }}
            >
              Reset to Full Image
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Check size={13} />}
            onClick={() => onApply(currentCrop)}
          >
            Apply Crop
          </Button>
        </div>
      </div>
    </div>
  )
}

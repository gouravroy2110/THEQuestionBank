import { useRef, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import {
  Plus, Trash2, ChevronUp, ChevronDown,
  ImagePlus, Type, Eye, EyeOff, AlignLeft, Crop
} from 'lucide-react'
import { useState } from 'react'
import type { ContentBlock, Segment, MarkdownSegment, ImageSegment } from '../../types'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ImageSegmentViewer } from './ImageSegmentViewer'
import { ImageCropper } from './ImageCropper'
import { storeImage } from '../../db/images'
import { Button, SectionLabel } from '../UI'

interface Props {
  block: ContentBlock
  onChange: (block: ContentBlock) => void
  label?: string
}

export function ContentBlockEditor({ block, onChange, label }: Props) {
  const [previewModes, setPreviewModes] = useState<Record<string, boolean>>({})
  const [croppingSegId, setCroppingSegId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImageSegId, setPendingImageSegId] = useState<string | null>(null)

  const updateSegments = (segs: Segment[]) => onChange({ ...block, segments: segs })

  const addMarkdownSegment = () => {
    const seg: MarkdownSegment = { type: 'markdown', id: uuid(), text: '' }
    updateSegments([...block.segments, seg])
  }

  const addImageSegment = (segId?: string) => {
    setPendingImageSegId(segId ?? '__new__')
    fileInputRef.current?.click()
  }

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await handleImageFile(file, pendingImageSegId)
    e.target.value = ''
    setPendingImageSegId(null)
  }

  const handleImageFile = async (file: File, targetSegId: string | null) => {
    const record = await storeImage(file, file.type)
    if (!record) {
      alert('Image store not set up. Please choose an image directory from the Hub.')
      return
    }
    if (targetSegId === '__new__') {
      const seg: ImageSegment = { type: 'image', id: uuid(), imageId: record.id, displayWidth: 100 }
      updateSegments([...block.segments, seg])
    } else if (targetSegId) {
      updateSegments(block.segments.map(s =>
        s.id === targetSegId && s.type === 'image'
          ? { ...s, imageId: record.id }
          : s
      ))
    }
  }

  // Paste handler for the whole editor
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const blob = imageItem.getAsFile()
    if (!blob) return
    await handleImageFile(blob, '__new__')
  }, [block.segments])

  const removeSegment = (id: string) => {
    updateSegments(block.segments.filter(s => s.id !== id))
  }

  const moveSegment = (id: string, dir: 'up' | 'down') => {
    const idx = block.segments.findIndex(s => s.id === id)
    if (idx < 0) return
    const newIdx = dir === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= block.segments.length) return
    const segs = [...block.segments]
    ;[segs[idx], segs[newIdx]] = [segs[newIdx], segs[idx]]
    updateSegments(segs)
  }

  const updateMarkdownText = (id: string, text: string) => {
    updateSegments(block.segments.map(s => s.id === id && s.type === 'markdown' ? { ...s, text } : s))
  }

  const updateImageMeta = (id: string, patch: Partial<ImageSegment>) => {
    updateSegments(block.segments.map(s => s.id === id && s.type === 'image' ? { ...s, ...patch } : s))
  }

  const togglePreview = (id: string) => {
    setPreviewModes(p => ({ ...p, [id]: !p[id] }))
  }

  return (
    <div className="flex flex-col gap-3" onPaste={handlePaste}>
      {label && <SectionLabel>{label}</SectionLabel>}

      {block.segments.length === 0 && (
        <div className="text-sm text-[var(--text-muted)] italic py-3 text-center border border-dashed border-[var(--border)] rounded-lg">
          No content yet — add a segment below
        </div>
      )}

      {block.segments.map((seg, idx) => (
        <div key={seg.id} className="group relative border border-[var(--border)] rounded-xl bg-[var(--bg-elevated)] overflow-hidden">
          {/* Segment toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-overlay)]">
            <div className="flex items-center gap-1.5">
              {seg.type === 'markdown'
                ? <><Type size={12} className="text-sky-400" /><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Markdown</span></>
                : <><ImagePlus size={12} className="text-emerald-400" /><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Image</span></>
              }
            </div>
            <div className="flex items-center gap-0.5">
              {seg.type === 'markdown' && (
                <button
                  onClick={() => togglePreview(seg.id)}
                  className="p-1 rounded hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  title="Toggle preview"
                >
                  {previewModes[seg.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              )}
              <button onClick={() => moveSegment(seg.id, 'up')} disabled={idx === 0} className="p-1 rounded hover:bg-[var(--border)] text-[var(--text-muted)] disabled:opacity-30 transition-colors">
                <ChevronUp size={12} />
              </button>
              <button onClick={() => moveSegment(seg.id, 'down')} disabled={idx === block.segments.length - 1} className="p-1 rounded hover:bg-[var(--border)] text-[var(--text-muted)] disabled:opacity-30 transition-colors">
                <ChevronDown size={12} />
              </button>
              <button onClick={() => removeSegment(seg.id)} className="p-1 rounded hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Segment body */}
          <div className="p-3">
            {seg.type === 'markdown' ? (
              previewModes[seg.id]
                ? <div className="min-h-[60px]"><MarkdownRenderer content={seg.text} /></div>
                : <textarea
                    className="w-full min-h-[80px] bg-transparent text-[var(--text-primary)] text-sm font-mono resize-y focus:outline-none placeholder-[var(--text-muted)] leading-relaxed"
                    placeholder="Type markdown here… supports **bold**, _italic_, `code`, $math$"
                    value={seg.text}
                    onChange={e => updateMarkdownText(seg.id, e.target.value)}
                    rows={4}
                  />
            ) : (
              <div className="space-y-2">
                {croppingSegId === seg.id ? (
                  <ImageCropper
                    imageId={seg.imageId}
                    crop={seg.crop}
                    onApply={newCrop => {
                      updateImageMeta(seg.id, { crop: newCrop })
                      setCroppingSegId(null)
                    }}
                    onReset={() => {
                      updateImageMeta(seg.id, { crop: undefined })
                      setCroppingSegId(null)
                    }}
                    onCancel={() => setCroppingSegId(null)}
                  />
                ) : (
                  <ImageSegmentViewer
                    imageId={seg.imageId}
                    caption={seg.caption}
                    displayWidth={seg.displayWidth}
                    crop={seg.crop}
                  />
                )}
                <div className="flex gap-2 flex-wrap items-center pt-1">
                  <Button size="sm" variant="ghost" icon={<ImagePlus size={12}/>} onClick={() => addImageSegment(seg.id)}>
                    Replace
                  </Button>
                  <Button
                    size="sm"
                    variant={seg.crop ? "primary" : "ghost"}
                    icon={<Crop size={12}/>}
                    onClick={() => setCroppingSegId(s => s === seg.id ? null : seg.id)}
                  >
                    {croppingSegId === seg.id ? 'Close Crop' : seg.crop ? 'Edit Crop' : 'Crop'}
                  </Button>
                  {seg.crop && (
                    <button
                      type="button"
                      onClick={() => updateImageMeta(seg.id, { crop: undefined })}
                      className="text-[11px] text-[var(--text-muted)] hover:text-rose-400 transition-colors px-1 underline"
                      title="Reset to full image"
                    >
                      Reset Crop
                    </button>
                  )}
                  <input
                    type="text"
                    placeholder="Caption (optional)"
                    value={seg.caption ?? ''}
                    onChange={e => updateImageMeta(seg.id, { caption: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-1 text-xs bg-[var(--bg-overlay)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center gap-1.5">
                    <AlignLeft size={11} className="text-[var(--text-muted)]" />
                    <input
                      type="range" min={20} max={100} step={5}
                      value={seg.displayWidth ?? 100}
                      onChange={e => updateImageMeta(seg.id, { displayWidth: Number(e.target.value) })}
                      className="w-20 accent-[var(--accent)]"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] w-8">{seg.displayWidth ?? 100}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add segment bar */}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" icon={<Plus size={12}/>} onClick={addMarkdownSegment}
          className="border border-dashed border-[var(--border)] flex-1 justify-center">
          Add Text
        </Button>
        <Button size="sm" variant="ghost" icon={<ImagePlus size={12}/>} onClick={() => addImageSegment()}
          className="border border-dashed border-[var(--border)] flex-1 justify-center">
          Add Image
        </Button>
      </div>

      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFilePick} />
    </div>
  )
}

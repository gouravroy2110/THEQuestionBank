import { useState } from 'react'
import type { ContentBlock } from '../../types'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ImageSegmentViewer, ImageLightbox } from './ImageSegmentViewer'

interface Props {
  block: ContentBlock
}

export function ContentBlockViewer({ block }: Props) {
  const [lightbox, setLightbox] = useState<{ url: string; crop?: any } | null>(null)

  if (!block.segments.length) {
    return <span className="text-[var(--text-muted)] italic text-sm">No content</span>
  }

  return (
    <div className="space-y-3">
      {block.segments.map(seg => (
        <div key={seg.id}>
          {seg.type === 'markdown' ? (
            <MarkdownRenderer content={seg.text} />
          ) : (
            <ImageSegmentViewer
              imageId={seg.imageId}
              caption={seg.caption}
              displayWidth={seg.displayWidth}
              crop={seg.crop}
              onLightbox={url => setLightbox({ url, crop: seg.crop })}
            />
          )}
        </div>
      ))}
      {lightbox && (
        <ImageLightbox
          url={lightbox.url}
          crop={lightbox.crop}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

import type { Question, Tag } from '../../types'
import { StatusBadge, DifficultyBadge, TagChip } from '../UI'
import { FileText, Image } from 'lucide-react'

interface Props {
  question: Question
  tags: Tag[]
  projectColor?: string
  active?: boolean
  onClick: () => void
}

export function QuestionCard({ question, tags, projectColor, active, onClick }: Props) {
  // Get a text preview from the first markdown segment
  const textPreview = question.questionContent.segments
    .find(s => s.type === 'markdown' && (s as any).text?.trim())
  const preview = textPreview ? (textPreview as any).text.slice(0, 120) : null

  const hasImages = question.questionContent.segments.some(s => s.type === 'image')

  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-xl border transition-all duration-150 px-4 py-3 group
        ${active
          ? 'border-[var(--accent)] bg-[var(--accent-glow)] shadow-sm'
          : 'border-[var(--border)] hover:border-[var(--border-bright)] hover:bg-[var(--bg-elevated)]'
        }
      `}
    >
      {/* Left accent line from project color */}
      {projectColor && (
        <div
          className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
          style={{ background: projectColor }}
        />
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={question.status} />
          <DifficultyBadge difficulty={question.difficulty} />
        </div>
        <div className="flex items-center gap-1 text-[var(--text-muted)]">
          {hasImages && <Image size={11}/>}
          {preview && <FileText size={11}/>}
        </div>
      </div>

      {preview ? (
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 font-mono leading-relaxed">
          {preview.replace(/\*\*|__|\*|_|`|#{1,6}\s/g, '')}
        </p>
      ) : (
        <p className="text-xs text-[var(--text-muted)] italic">Image only</p>
      )}

      {question.source && (
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5 truncate">{question.source}</p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.slice(0, 3).map(t => (
            <TagChip key={t.id} name={t.name} color={t.color} size="sm" />
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-[var(--text-muted)] self-center">+{tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Edit, Eye, EyeOff, Lightbulb, BookOpen } from 'lucide-react'
import type { ResolvedQuestion } from '../../types'
import { ContentBlockViewer } from '../ContentBlock/ContentBlockViewer'
import { StatusBadge, DifficultyBadge, TagChip, Button } from '../UI'

interface Props {
  question: ResolvedQuestion
  total: number
  index: number
  onPrev: () => void
  onNext: () => void
  onEdit?: () => void
}

export function QuestionDetail({ question, total, index, onPrev, onNext, onEdit }: Props) {
  const [solutionVisible, setSolutionVisible] = useState(false)

  // Hide solution when question changes
  useEffect(() => { setSolutionVisible(false) }, [question.id])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') onNext()
      if (e.key === 'ArrowLeft')  onPrev()
      if (e.key === 's' || e.key === 'S') setSolutionVisible(v => !v)
      if ((e.key === 'e' || e.key === 'E') && onEdit) onEdit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNext, onPrev, onEdit])

  const projectTags = question.effectiveTags.filter(t => question.project?.tagIds.includes(t.id))
  const directTags  = question.effectiveTags.filter(t => !question.project?.tagIds.includes(t.id))

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {index + 1} <span className="opacity-50">/</span> {total}
          </span>
          <StatusBadge status={question.status} />
          <DifficultyBadge difficulty={question.difficulty} />
          {question.source && (
            <span className="text-xs text-[var(--text-muted)] border border-[var(--border)] px-2 py-0.5 rounded-md">
              {question.source}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button variant="ghost" size="sm" icon={<Edit size={13}/>} onClick={onEdit}>
              Edit
            </Button>
          )}
          <button onClick={onPrev} disabled={index === 0}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-bright)] disabled:opacity-30 transition-colors">
            <ChevronLeft size={15}/>
          </button>
          <button onClick={onNext} disabled={index === total - 1}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-bright)] disabled:opacity-30 transition-colors">
            <ChevronRight size={15}/>
          </button>
        </div>
      </div>

      {/* Tags row */}
      {(question.effectiveTags.length > 0 || question.effectiveMetadata.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
          {question.project && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md font-medium border"
              style={{
                color: question.project.color,
                borderColor: `${question.project.color}44`,
                background: `${question.project.color}15`,
              }}
            >
              {question.project.name}
            </span>
          )}
          {projectTags.map(t => <TagChip key={t.id} name={t.name} color={t.color} size="sm" dimmed />)}
          {directTags.map(t => <TagChip key={t.id} name={t.name} color={t.color} size="sm" />)}
          {question.effectiveMetadata.map((m, i) => (
            <span key={i} className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded">
              <span className="opacity-60">{m.key}:</span> {m.value}
            </span>
          ))}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

        {/* Question */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-sky-400" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Question</span>
          </div>
          <ContentBlockViewer block={question.questionContent} />
        </div>

        {/* Solution divider + toggle */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-[var(--border)]" />
            <button
              onClick={() => setSolutionVisible(v => !v)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium transition-all ${
                solutionVisible
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-amber-500/40 hover:text-amber-400'
              }`}
            >
              <Lightbulb size={13} />
              {solutionVisible ? 'Hide Solution' : 'Show Solution'}
              <span className="text-[var(--text-muted)] opacity-60 text-[10px]">[S]</span>
            </button>
            <div className="flex-1 border-t border-[var(--border)]" />
          </div>

          {solutionVisible && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <Lightbulb size={14} className="text-amber-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Solution</span>
              </div>
              <div className="border border-amber-500/20 rounded-xl p-5 bg-amber-500/5">
                <ContentBlockViewer block={question.solutionContent} />
              </div>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex justify-between pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={13}/>} onClick={onPrev} disabled={index === 0}>
            Previous
          </Button>
          <Button variant="ghost" size="sm" onClick={onNext} disabled={index === total - 1}>
            Next <ChevronRight size={13}/>
          </Button>
        </div>
      </div>
    </div>
  )
}

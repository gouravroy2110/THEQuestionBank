import { useState, useEffect, useCallback } from 'react'
import { Save, X, BookOpen, Lightbulb, Tags, Sliders } from 'lucide-react'
import type { Question, ResolvedQuestion, Status, Difficulty } from '../../types'
import { saveQuestion } from '../../db/questions'
import { broadcast } from '../../hooks/useBroadcast'
import { ContentBlockEditor } from '../ContentBlock/ContentBlockEditor'
import { OptionsEditor } from './OptionsEditor'
import { TagInput } from '../Tags/TagInput'
import { Button, SectionLabel } from '../UI'

interface Props {
  question: ResolvedQuestion
  onSave: (updated: Question) => void
  onCancel: () => void
}

const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: 'unattempted', label: 'Unattempted', color: '#858585' },
  { value: 'wrong', label: 'Wrong', color: '#f43f5e' },
  { value: 'partial', label: 'Partial', color: '#f59e0b' },
  { value: 'correct', label: 'Correct', color: '#10b981' },
]

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'unseen', label: 'Unseen', color: '#8b5cf6' },
  { value: 'easy', label: 'Easy', color: '#10b981' },
  { value: 'medium', label: 'Medium', color: '#0ea5e9' },
  { value: 'hard', label: 'Hard', color: '#f43f5e' },
]

export function QuickEditForm({ question, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Question>(question)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setForm(question)
    setDirty(false)
  }, [question.id])

  const update = useCallback((patch: Partial<Question>) => {
    setForm(f => {
      setDirty(true)
      return { ...f, ...patch }
    })
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await saveQuestion(form)
    broadcast({ type: 'question:saved', payload: { id: form.id, projectId: form.projectId } })
    setSaving(false)
    setDirty(false)
    onSave(form)
  }, [form, onSave])

  // Keybindings: Ctrl+S to save, Esc to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, onCancel])

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)] overflow-hidden">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display font-semibold text-sm text-[var(--accent)] flex items-center gap-1.5">
            <Sliders size={15} /> Quick Edit Mode
          </span>
          {dirty && (
            <span className="text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-medium animate-pulse">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<X size={13} />}
            onClick={onCancel}
          >
            Cancel <span className="text-[10px] text-[var(--text-muted)] ml-1">Esc</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={13} />}
            loading={saving}
            onClick={handleSave}
          >
            Save Changes <span className="text-white/60 text-[10px] ml-1">Ctrl+S</span>
          </Button>
        </div>
      </div>

      {/* Form Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* Status and Difficulty Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <div>
            <SectionLabel>Status</SectionLabel>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => update({ status: s.value })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    form.status === s.value
                      ? 'border-transparent text-white'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)]'
                  }`}
                  style={form.status === s.value ? { background: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Difficulty</SectionLabel>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => update({ difficulty: d.value })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    form.difficulty === d.value
                      ? 'border-transparent text-white'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)]'
                  }`}
                  style={form.difficulty === d.value ? { background: d.color } : {}}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Question Content Editor */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-[var(--accent)]" />
            <SectionLabel>Question Content</SectionLabel>
          </div>
          <ContentBlockEditor
            block={form.questionContent}
            onChange={b => update({ questionContent: b })}
          />
        </div>

        {/* Options & Answering Editor */}
        <OptionsEditor
          questionType={form.questionType ?? 'none'}
          options={form.options ?? []}
          correctAnswer={form.correctAnswer}
          onChange={data =>
            update({
              questionType: data.questionType,
              options: data.options,
              correctAnswer: data.correctAnswer,
            })
          }
        />

        {/* Solution Content Editor */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb size={15} className="text-amber-400" />
            <SectionLabel>Solution & Explanation</SectionLabel>
          </div>
          <ContentBlockEditor
            block={form.solutionContent}
            onChange={b => update({ solutionContent: b })}
          />
        </div>

        {/* Direct Tags Editor */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tags size={15} className="text-[var(--accent)]" />
              <SectionLabel>Question Tags</SectionLabel>
            </div>
            {question.project && question.project.tagIds.length > 0 && (
              <span className="text-[11px] text-[var(--text-muted)]">
                Project tags from &ldquo;{question.project.name}&rdquo; are automatically inherited
              </span>
            )}
          </div>
          <TagInput
            selectedIds={form.tagIds}
            projectTagIds={question.project?.tagIds ?? []}
            onChange={tagIds => update({ tagIds })}
          />
        </div>
      </div>
    </div>
  )
}

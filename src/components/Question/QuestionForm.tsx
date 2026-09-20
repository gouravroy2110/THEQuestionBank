import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Save, BookOpen, Lightbulb, Tags, Info, ChevronDown, ChevronUp } from 'lucide-react'
import type { Question, Project } from '../../types'
import { saveQuestion } from '../../db/questions'
import { db } from '../../db/schema'
import { ContentBlockEditor } from '../ContentBlock/ContentBlockEditor'
import { OptionsEditor } from './OptionsEditor'
import { TagInput } from '../Tags/TagInput'
import { TagManager } from '../Tags/TagManager'
import { MetaEditor } from '../Metadata/MetaEditor'
import { Button, Select, SectionLabel } from '../UI'
import { broadcast } from '../../hooks/useBroadcast'

interface Props {
  question: Question
  onSaved: (q: Question) => void
  onChanged?: (q: Question) => void
}

const STATUS_OPTIONS = [
  { value: 'unattempted', label: 'Unattempted' },
  { value: 'wrong',       label: 'Wrong' },
  { value: 'partial',     label: 'Partial' },
  { value: 'correct',     label: 'Correct' },
]

const DIFF_OPTIONS = [
  { value: 'unseen', label: 'Unseen' },
  { value: 'easy',   label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard' },
]

export function QuestionForm({ question, onSaved, onChanged }: Props) {
  const [form, setForm]           = useState<Question>(question)
  const [saving, setSaving]       = useState(false)
  const [dirty, setDirty]         = useState(false)
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [solutionOpen, setSolutionOpen]     = useState(true)
  const [metaOpen, setMetaOpen]             = useState(false)

  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? []
  const project: Project | undefined = projects.find(p => p.id === form.projectId)

  // Reset form when question prop changes
  useEffect(() => {
    setForm(question)
    setDirty(false)
  }, [question.id])

  const update = useCallback((patch: Partial<Question>) => {
    setForm(f => {
      const next = { ...f, ...patch }
      onChanged?.(next)
      setDirty(true)
      return next
    })
  }, [onChanged])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await saveQuestion(form)
    broadcast({ type: 'question:saved', payload: { id: form.id, projectId: form.projectId } })
    setDirty(false)
    setSaving(false)
    onSaved(form)
  }, [form, onSaved])

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const projectOptions = [
    { value: '', label: '— No Project —' },
    ...projects.map(p => ({ value: p.id, label: p.name })),
  ]

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {dirty && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes"/>}
          <Select
            options={projectOptions}
            value={form.projectId ?? ''}
            onChange={e => update({ projectId: e.target.value || null })}
            className="text-xs py-1 h-7 border-[var(--border-bright)]"
          />
        </div>
        <Button
          variant="primary" size="sm"
          icon={<Save size={13}/>}
          loading={saving}
          onClick={handleSave}
        >
          Save {dirty ? '*' : ''}
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

        {/* ── Status / Difficulty / Source ── */}
        <div className="grid grid-cols-3 gap-3">
          <Select label="Status" options={STATUS_OPTIONS} value={form.status}
            onChange={e => update({ status: e.target.value as Question['status'] })} />
          <Select label="Difficulty" options={DIFF_OPTIONS} value={form.difficulty}
            onChange={e => update({ difficulty: e.target.value as Question['difficulty'] })} />
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Source</SectionLabel>
            <input
              className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="Mock 4, Q12…"
              value={form.source}
              onChange={e => update({ source: e.target.value })}
            />
          </div>
        </div>

        {/* ── Question Content ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-sky-400" />
            <SectionLabel>Question</SectionLabel>
          </div>
          <div className="border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-elevated)]">
            <ContentBlockEditor
              block={form.questionContent}
              onChange={questionContent => update({ questionContent })}
            />
          </div>
        </div>

        {/* ── Options & Answering ── */}
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

        {/* ── Solution ── */}
        <div className="space-y-2">
          <button
            className="flex items-center gap-2 w-full group"
            onClick={() => setSolutionOpen(o => !o)}
          >
            <Lightbulb size={14} className="text-amber-400" />
            <SectionLabel>Solution</SectionLabel>
            <div className="flex-1 border-t border-[var(--border)] mx-2" />
            <span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
              {solutionOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            </span>
          </button>
          {solutionOpen && (
            <div className="border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-elevated)] animate-fade-in">
              <ContentBlockEditor
                block={form.solutionContent}
                onChange={solutionContent => update({ solutionContent })}
              />
            </div>
          )}
        </div>

        {/* ── Tags ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tags size={14} className="text-violet-400" />
            <SectionLabel>Tags</SectionLabel>
          </div>
          <TagInput
            selectedIds={form.tagIds}
            onChange={tagIds => update({ tagIds })}
            projectTagIds={project?.tagIds ?? []}
            onOpenManager={() => setTagManagerOpen(true)}
          />
        </div>

        {/* ── Metadata (collapsible) ── */}
        <div className="space-y-2">
          <button
            className="flex items-center gap-2 w-full group"
            onClick={() => setMetaOpen(o => !o)}
          >
            <Info size={14} className="text-emerald-400" />
            <SectionLabel>Metadata</SectionLabel>
            <div className="flex-1 border-t border-[var(--border)] mx-2" />
            <span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
              {metaOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            </span>
          </button>
          {metaOpen && (
            <div className="border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-elevated)] animate-fade-in">
              <MetaEditor
                fields={form.metadata}
                onChange={metadata => update({ metadata })}
                inheritedFields={project?.metadata ?? []}
                projectName={project?.name}
              />
            </div>
          )}
        </div>

      </div>

      <TagManager open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} />
    </div>
  )
}

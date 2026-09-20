import { useState } from 'react'
import { Plus, Trash2, CheckCircle2, Circle, CheckSquare, Square, Hash } from 'lucide-react'
import type { QuestionType, QuestionOption, CorrectAnswer } from '../../types'
import { v4 as uuid } from 'uuid'

interface Props {
  questionType: QuestionType
  options?: QuestionOption[]
  correctAnswer?: CorrectAnswer
  onChange: (data: {
    questionType: QuestionType
    options: QuestionOption[]
    correctAnswer?: CorrectAnswer
  }) => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

export function OptionsEditor({
  questionType = 'none',
  options = [],
  correctAnswer,
  onChange,
}: Props) {
  const [natMode, setNatMode] = useState<'exact' | 'range'>(() => {
    if (correctAnswer?.type === 'nat') {
      return correctAnswer.answer.min !== undefined && correctAnswer.answer.max !== undefined
        ? 'range'
        : 'exact'
    }
    return 'exact'
  })

  const setType = (newType: QuestionType) => {
    if (newType === questionType) return

    let nextOptions = [...options]
    let nextAnswer: CorrectAnswer | undefined = undefined

    if (newType === 'mcq') {
      if (nextOptions.length === 0) {
        nextOptions = [
          { id: uuid(), text: '' },
          { id: uuid(), text: '' },
          { id: uuid(), text: '' },
          { id: uuid(), text: '' },
        ]
      }
      nextAnswer = { type: 'mcq', optionId: nextOptions[0]?.id ?? '' }
    } else if (newType === 'msq') {
      if (nextOptions.length === 0) {
        nextOptions = [
          { id: uuid(), text: '' },
          { id: uuid(), text: '' },
          { id: uuid(), text: '' },
          { id: uuid(), text: '' },
        ]
      }
      nextAnswer = { type: 'msq', optionIds: nextOptions[0] ? [nextOptions[0].id] : [] }
    } else if (newType === 'nat') {
      nextAnswer = { type: 'nat', answer: { value: 0 } }
    }

    onChange({ questionType: newType, options: nextOptions, correctAnswer: nextAnswer })
  }

  // ── Option Handlers (MCQ / MSQ) ──
  const handleAddOption = () => {
    const newOpt: QuestionOption = { id: uuid(), text: '' }
    const nextOptions = [...options, newOpt]
    onChange({ questionType, options: nextOptions, correctAnswer })
  }

  const handleRemoveOption = (id: string) => {
    const nextOptions = options.filter(o => o.id !== id)
    let nextAnswer = correctAnswer

    if (correctAnswer?.type === 'mcq' && correctAnswer.optionId === id) {
      nextAnswer = { type: 'mcq', optionId: nextOptions[0]?.id ?? '' }
    } else if (correctAnswer?.type === 'msq') {
      nextAnswer = {
        type: 'msq',
        optionIds: correctAnswer.optionIds.filter(oid => oid !== id),
      }
    }

    onChange({ questionType, options: nextOptions, correctAnswer: nextAnswer })
  }

  const handleOptionTextChange = (id: string, text: string) => {
    const nextOptions = options.map(o => (o.id === id ? { ...o, text } : o))
    onChange({ questionType, options: nextOptions, correctAnswer })
  }

  const handleToggleCorrect = (id: string) => {
    if (questionType === 'mcq') {
      onChange({
        questionType,
        options,
        correctAnswer: { type: 'mcq', optionId: id },
      })
    } else if (questionType === 'msq') {
      const currentIds = correctAnswer?.type === 'msq' ? correctAnswer.optionIds : []
      const nextIds = currentIds.includes(id)
        ? currentIds.filter(oid => oid !== id)
        : [...currentIds, id]

      onChange({
        questionType,
        options,
        correctAnswer: { type: 'msq', optionIds: nextIds },
      })
    }
  }

  // ── NAT Handlers ──
  const handleNatChange = (patch: { value?: number; min?: number; max?: number }) => {
    const current = correctAnswer?.type === 'nat' ? correctAnswer.answer : {}
    const updated = { ...current, ...patch }
    onChange({
      questionType,
      options,
      correctAnswer: { type: 'nat', answer: updated },
    })
  }

  return (
    <div className="space-y-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
      {/* Type Selector Bar */}
      <div>
        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Question Type & Options
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'none', label: 'None (Theory)' },
            { id: 'mcq', label: 'MCQ (Single)' },
            { id: 'msq', label: 'MSQ (Multiple)' },
            { id: 'nat', label: 'NAT (Numerical)' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id as QuestionType)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center ${
                questionType === t.id
                  ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text-primary)] shadow-sm'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-bright)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* None Mode */}
      {questionType === 'none' && (
        <p className="text-xs text-[var(--text-muted)] italic">
          No options configured. The question will be displayed as an open theoretical question.
        </p>
      )}

      {/* MCQ / MSQ Options Editor */}
      {(questionType === 'mcq' || questionType === 'msq') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              Mark the correct option{questionType === 'msq' ? 's' : ''} using the {questionType === 'mcq' ? 'radio button' : 'checkbox'}.
            </span>
            <span>{options.length} option{options.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-2">
            {options.map((opt, idx) => {
              const letter = LETTERS[idx] ?? `${idx + 1}`
              const isCorrect =
                questionType === 'mcq'
                  ? correctAnswer?.type === 'mcq' && correctAnswer.optionId === opt.id
                  : correctAnswer?.type === 'msq' && correctAnswer.optionIds.includes(opt.id)

              return (
                <div
                  key={opt.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    isCorrect
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-[var(--border)] bg-[var(--bg-elevated)]'
                  }`}
                >
                  {/* Correct Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleCorrect(opt.id)}
                    className="p-1 rounded text-emerald-400 hover:opacity-80 transition-opacity flex-shrink-0"
                    title={isCorrect ? 'Marked as correct' : 'Click to mark as correct'}
                  >
                    {questionType === 'mcq' ? (
                      isCorrect ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Circle size={18} className="text-[var(--text-muted)]" />
                    ) : (
                      isCorrect ? <CheckSquare size={18} className="text-emerald-400" /> : <Square size={18} className="text-[var(--text-muted)]" />
                    )}
                  </button>

                  {/* Letter Badge */}
                  <span className="w-5 text-center font-mono text-xs font-semibold text-[var(--text-muted)] flex-shrink-0">
                    {letter}.
                  </span>

                  {/* Option Text Input */}
                  <input
                    type="text"
                    value={opt.text}
                    onChange={e => handleOptionTextChange(opt.id, e.target.value)}
                    placeholder={`Option ${letter} (supports Markdown & $KaTeX$)`}
                    className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border-none"
                  />

                  {/* Delete Button */}
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(opt.id)}
                      className="p-1 text-[var(--text-muted)] hover:text-rose-400 transition-colors flex-shrink-0"
                      title="Remove option"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleAddOption}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
          >
            <Plus size={13} /> Add Option
          </button>
        </div>
      )}

      {/* NAT Editor */}
      {questionType === 'nat' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Mode:</span>
            <button
              type="button"
              onClick={() => {
                setNatMode('exact')
                handleNatChange({ value: (correctAnswer?.type === 'nat' && correctAnswer.answer.value) || 0, min: undefined, max: undefined })
              }}
              className={`px-2.5 py-1 text-xs rounded-md border ${
                natMode === 'exact'
                  ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] text-[var(--text-muted)]'
              }`}
            >
              Exact Number
            </button>
            <button
              type="button"
              onClick={() => {
                setNatMode('range')
                handleNatChange({ min: 0, max: 0, value: undefined })
              }}
              className={`px-2.5 py-1 text-xs rounded-md border ${
                natMode === 'range'
                  ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] text-[var(--text-muted)]'
              }`}
            >
              Range [Min, Max]
            </button>
          </div>

          {natMode === 'exact' ? (
            <div className="flex items-center gap-2 max-w-xs">
              <span className="text-xs text-[var(--text-muted)]">Answer:</span>
              <div className="relative flex-1">
                <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="number"
                  step="any"
                  value={correctAnswer?.type === 'nat' ? correctAnswer.answer.value ?? '' : ''}
                  onChange={e => handleNatChange({ value: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  placeholder="e.g. 4000"
                  className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Min:</span>
                <input
                  type="number"
                  step="any"
                  value={correctAnswer?.type === 'nat' ? correctAnswer.answer.min ?? '' : ''}
                  onChange={e => handleNatChange({ min: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  placeholder="e.g. 3.9"
                  className="w-28 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Max:</span>
                <input
                  type="number"
                  step="any"
                  value={correctAnswer?.type === 'nat' ? correctAnswer.answer.max ?? '' : ''}
                  onChange={e => handleNatChange({ max: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  placeholder="e.g. 4.1"
                  className="w-28 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

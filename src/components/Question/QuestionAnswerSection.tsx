import { useState, useMemo, useEffect } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Check,
  Circle,
  CheckSquare,
  Square,
  Hash,
  Eye,
} from 'lucide-react'
import type { Question, Status } from '../../types'
import { MarkdownRenderer } from '../ContentBlock/MarkdownRenderer'

interface Props {
  question: Question
  showAnswers: boolean
  shuffleOptions: boolean
  onStatusChange?: (newStatus: Status) => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

export function QuestionAnswerSection({
  question,
  showAnswers,
  shuffleOptions,
  onStatusChange,
}: Props) {
  const type = question.questionType ?? 'none'
  const options = question.options ?? []
  const correctAnswer = question.correctAnswer

  // User attempt state
  const [selectedMcq, setSelectedMcq] = useState<string | null>(null)
  const [selectedMsq, setSelectedMsq] = useState<string[]>([])
  const [natInput, setNatInput] = useState<string>('')
  const [checked, setChecked] = useState(false)
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong' | 'partial'>('idle')

  // Reset attempt state when question ID changes
  useEffect(() => {
    setSelectedMcq(null)
    setSelectedMsq([])
    setNatInput('')
    setChecked(false)
    setFeedback('idle')
  }, [question.id])

  // Display options (shuffled if shuffleOptions is active)
  const displayOptions = useMemo(() => {
    if (!shuffleOptions || options.length <= 1) return options

    // Deterministic shuffle per question id using simple hash
    const arr = [...options]
    let seed = 0
    for (let i = 0; i < question.id.length; i++) {
      seed = (seed << 5) - seed + question.id.charCodeAt(i)
      seed |= 0
    }

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.abs((seed + i * 31) % (i + 1))
      const temp = arr[i]
      arr[i] = arr[j]
      arr[j] = temp
    }
    return arr
  }, [options, shuffleOptions, question.id])

  if (type === 'none') {
    return null
  }

  // ── Validation Logic ──
  const handleCheck = () => {
    if (!correctAnswer) {
      setChecked(true)
      return
    }

    if (type === 'mcq') {
      if (!selectedMcq) return
      const isCorrect = correctAnswer.type === 'mcq' && correctAnswer.optionId === selectedMcq
      setFeedback(isCorrect ? 'correct' : 'wrong')
    } else if (type === 'msq') {
      if (selectedMsq.length === 0) return
      const correctIds = correctAnswer.type === 'msq' ? correctAnswer.optionIds : []
      const hasWrong = selectedMsq.some(id => !correctIds.includes(id))
      const allCorrectSelected =
        correctIds.length > 0 &&
        correctIds.every(id => selectedMsq.includes(id)) &&
        !hasWrong

      if (allCorrectSelected) {
        setFeedback('correct')
      } else if (!hasWrong && selectedMsq.some(id => correctIds.includes(id))) {
        setFeedback('partial')
      } else {
        setFeedback('wrong')
      }
    } else if (type === 'nat') {
      if (!natInput.trim()) return
      const val = parseFloat(natInput)
      if (isNaN(val)) {
        setFeedback('wrong')
      } else if (correctAnswer.type === 'nat') {
        const { value, min, max } = correctAnswer.answer
        if (min !== undefined && max !== undefined) {
          setFeedback(val >= min && val <= max ? 'correct' : 'wrong')
        } else if (value !== undefined) {
          setFeedback(val === value ? 'correct' : 'wrong')
        } else {
          setFeedback('wrong')
        }
      }
    }

    setChecked(true)
  }

  const handleReset = () => {
    setSelectedMcq(null)
    setSelectedMsq([])
    setNatInput('')
    setChecked(false)
    setFeedback('idle')
  }

  // Determine correct status for an option
  const isOptionCorrect = (optId: string) => {
    if (!correctAnswer) return false
    if (correctAnswer.type === 'mcq') return correctAnswer.optionId === optId
    if (correctAnswer.type === 'msq') return correctAnswer.optionIds.includes(optId)
    return false
  }

  return (
    <div className="my-5 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle size={15} className="text-[var(--accent)]" />
          <span className="font-display font-semibold text-xs uppercase tracking-wider text-[var(--text-primary)]">
            {type === 'mcq'
              ? 'Multiple Choice (Single Option)'
              : type === 'msq'
              ? 'Multiple Select (One or More Options)'
              : 'Numerical Answer'}
          </span>
        </div>

        {showAnswers && (
          <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-medium">
            <Eye size={12} /> Answers Revealed
          </span>
        )}
      </div>

      {/* MCQ Options */}
      {type === 'mcq' && (
        <div className="space-y-2">
          {displayOptions.map((opt, idx) => {
            const letter = LETTERS[idx] ?? `${idx + 1}`
            const isSelected = selectedMcq === opt.id
            const isCorrect = isOptionCorrect(opt.id)
            const revealCorrect = showAnswers || (checked && isCorrect)
            const revealWrong = checked && isSelected && !isCorrect

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (checked) setChecked(false)
                  setSelectedMcq(opt.id)
                }}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  revealCorrect
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                    : revealWrong
                    ? 'border-rose-500 bg-rose-500/10 text-rose-200'
                    : isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text-primary)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-bright)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {revealCorrect ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : revealWrong ? (
                    <XCircle size={16} className="text-rose-400" />
                  ) : isSelected ? (
                    <div className="w-4 h-4 rounded-full border-2 border-[var(--accent)] flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                    </div>
                  ) : (
                    <Circle size={16} className="text-[var(--text-muted)]" />
                  )}
                </div>

                <span className="font-mono text-xs font-bold text-[var(--text-muted)] mt-0.5 flex-shrink-0">
                  {letter}.
                </span>

                <div className="flex-1 min-w-0">
                  <MarkdownRenderer content={opt.text} className="text-sm text-inherit" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* MSQ Options */}
      {type === 'msq' && (
        <div className="space-y-2">
          {displayOptions.map((opt, idx) => {
            const letter = LETTERS[idx] ?? `${idx + 1}`
            const isSelected = selectedMsq.includes(opt.id)
            const isCorrect = isOptionCorrect(opt.id)
            const revealCorrect = showAnswers || (checked && isCorrect)
            const revealWrong = checked && isSelected && !isCorrect

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (checked) setChecked(false)
                  setSelectedMsq(ids =>
                    ids.includes(opt.id) ? ids.filter(x => x !== opt.id) : [...ids, opt.id]
                  )
                }}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  revealCorrect
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                    : revealWrong
                    ? 'border-rose-500 bg-rose-500/10 text-rose-200'
                    : isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text-primary)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-bright)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {revealCorrect ? (
                    <CheckSquare size={16} className="text-emerald-400" />
                  ) : revealWrong ? (
                    <XCircle size={16} className="text-rose-400" />
                  ) : isSelected ? (
                    <CheckSquare size={16} className="text-[var(--accent)]" />
                  ) : (
                    <Square size={16} className="text-[var(--text-muted)]" />
                  )}
                </div>

                <span className="font-mono text-xs font-bold text-[var(--text-muted)] mt-0.5 flex-shrink-0">
                  {letter}.
                </span>

                <div className="flex-1 min-w-0">
                  <MarkdownRenderer content={opt.text} className="text-sm text-inherit" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* NAT Input */}
      {type === 'nat' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative w-48">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="number"
                step="any"
                value={natInput}
                onChange={e => {
                  if (checked) setChecked(false)
                  setNatInput(e.target.value)
                }}
                placeholder="Enter numerical answer"
                className={`w-full pl-8 pr-3 py-2 bg-[var(--bg-surface)] border rounded-lg text-sm font-mono text-[var(--text-primary)] outline-none transition-colors ${
                  checked && feedback === 'correct'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : checked && feedback === 'wrong'
                    ? 'border-rose-500 bg-rose-500/10'
                    : 'border-[var(--border)] focus:border-[var(--accent)]'
                }`}
              />
            </div>

            {showAnswers && correctAnswer?.type === 'nat' && (
              <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                Correct Answer:{' '}
                {correctAnswer.answer.min !== undefined && correctAnswer.answer.max !== undefined
                  ? `[${correctAnswer.answer.min}, ${correctAnswer.answer.max}]`
                  : correctAnswer.answer.value ?? 'N/A'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action and Feedback Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border)]/60">
        <div className="flex items-center gap-2">
          {!showAnswers && (
            <button
              type="button"
              onClick={handleCheck}
              disabled={
                (type === 'mcq' && !selectedMcq) ||
                (type === 'msq' && selectedMsq.length === 0) ||
                (type === 'nat' && !natInput.trim())
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <Check size={13} /> Check Answer
            </button>
          )}

          {checked && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-bright)] transition-colors"
            >
              <RotateCcw size={12} /> Try Again
            </button>
          )}
        </div>

        {/* Feedback Badge & Optional Status Update */}
        {checked && (
          <div className="flex items-center gap-2">
            {feedback === 'correct' && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
                <CheckCircle2 size={13} /> Correct! 🎉
              </span>
            )}
            {feedback === 'wrong' && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30">
                <XCircle size={13} /> Incorrect ❌
              </span>
            )}
            {feedback === 'partial' && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30">
                <AlertCircle size={13} /> Partially Correct ⚠️
              </span>
            )}

            {/* Optional manual status updater */}
            {onStatusChange && feedback !== 'idle' && (
              <button
                type="button"
                onClick={() => {
                  if (feedback === 'correct') onStatusChange('correct')
                  else if (feedback === 'partial') onStatusChange('partial')
                  else onStatusChange('wrong')
                }}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline ml-1"
                title="Update this question's status in your question bank"
              >
                Set status to {feedback === 'correct' ? 'Correct' : feedback === 'partial' ? 'Partial' : 'Wrong'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

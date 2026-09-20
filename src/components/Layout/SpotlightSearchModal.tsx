import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Sparkles, CornerDownLeft, Command, HelpCircle } from 'lucide-react'
import type { Question, Tag, Project, FilterState } from '../../types'
import {
  parseQuery,
  parseSetQuery,
  evaluateQueryAST,
  executeSetQuery,
  serializeFilterToQuery,
  tryExtractFilterState,
  getAutocompletions,
  type AutocompleteItem,
} from '../../utils/queryParser'

interface Props {
  isOpen: boolean
  onClose: () => void
  filter: FilterState
  onApplyFilter: (newFilter: FilterState) => void
  projects: Project[]
  tags: Tag[]
  questions: Question[]
  tagMap: Map<string, Tag>
  projectMap: Map<string, Project>
}

export function SpotlightSearchModal({
  isOpen,
  onClose,
  filter,
  onApplyFilter,
  projects,
  tags,
  questions,
  tagMap,
  projectMap,
}: Props) {
  const [query, setQuery] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`
    }
  }

  // When modal opens, populate with serialized current filter
  useEffect(() => {
    if (isOpen) {
      const initial = filter.rawQuery ?? serializeFilterToQuery(filter, projectMap, tagMap)
      setQuery(initial)
      setCursorPos(initial.length)
      setSelectedIndex(0)

      // Focus textarea and adjust height
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(initial.length, initial.length)
          adjustHeight()
        }
      }, 50)
    }
  }, [isOpen])

  // Autocomplete items
  const { items: suggestions, replaceRange } = useMemo(() => {
    if (!isOpen) return { items: [], replaceRange: [0, 0] as [number, number] }
    return getAutocompletions(query, cursorPos, projects, tags)
  }, [query, cursorPos, projects, tags, isOpen])

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0)
  }, [suggestions.length])

  // Live match count
  const matchCount = useMemo(() => {
    if (!query.trim()) return questions.length
    const setNode = parseSetQuery(query)
    if (!setNode) return questions.length
    return executeSetQuery(setNode, questions, tagMap, projectMap, filter.randomSeed).length
  }, [query, questions, tagMap, projectMap, filter.randomSeed])

  if (!isOpen) return null

  const handleApply = (targetQuery = query) => {
    const trimmed = targetQuery.trim()
    if (!trimmed) {
      onApplyFilter({
        ...filter,
        projectId: 'all',
        projectIds: [],
        statuses: [],
        difficulties: [],
        tagIds: [],
        textSearch: '',
        rawQuery: undefined,
      })
      onClose()
      return
    }

    const extracted = tryExtractFilterState(trimmed, projects, tags)
    onApplyFilter({
      ...filter,
      ...extracted,
      rawQuery: trimmed,
    })
    onClose()
  }

  const handleSelectSuggestion = (item: AutocompleteItem) => {
    const [start, end] = replaceRange
    const before = query.slice(0, start)
    const after = query.slice(end)

    // Directives like @project: should NOT have trailing space so suggestions pop up immediately
    const needsTrailingSpace =
      item.type !== 'directive' &&
      !item.insertText.endsWith(' ') &&
      !after.startsWith(' ')

    const nextQuery = before + item.insertText + (needsTrailingSpace ? ' ' : '') + after
    const nextCursor = start + item.insertText.length + (needsTrailingSpace ? 1 : 0)

    setQuery(nextQuery)
    setCursorPos(nextCursor)

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(nextCursor, nextCursor)
        adjustHeight()
      }
    }, 10)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[selectedIndex] || suggestions[0])
      } else {
        // If tab pressed and no suggestions, toggle close
        onClose()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % suggestions.length)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      if (suggestions.length > 0) {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length)
      }
      return
    }

    if (e.key === 'Enter') {
      // Allow Shift+Enter for newline if desired, otherwise apply
      if (!e.shiftKey) {
        e.preventDefault()
        if (suggestions.length > 0 && e.ctrlKey) {
          handleSelectSuggestion(suggestions[selectedIndex] || suggestions[0])
        } else {
          handleApply()
        }
        return
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value)
    setCursorPos(e.target.selectionStart ?? e.target.value.length)
    adjustHeight()
  }

  const handleInputSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCursorPos((e.target as HTMLTextAreaElement).selectionStart ?? query.length)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-bright)] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px var(--accent-glow)' }}
      >
        {/* Spotlight Top Input Bar */}
        <div className="relative flex items-start px-4 py-3.5 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
          <Search size={18} className="text-[var(--accent)] mr-3 mt-1 flex-shrink-0" />
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-base font-mono outline-none border-none resize-none leading-relaxed overflow-y-auto max-h-36 pr-2 py-0"
            placeholder="Type query e.g. @project:P1 UNION @project:P2 or random(@project:P1, 20, 42) or [:40]..."
            value={query}
            onChange={handleInputChange}
            onSelect={handleInputSelect}
            onKeyDown={handleKeyDown}
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('')
                setCursorPos(0)
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.focus()
                    adjustHeight()
                  }
                }, 10)
              }}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors mt-0.5"
              title="Clear input"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        {/* Autocomplete Dropdown */}
        {suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="max-h-60 overflow-y-auto divide-y divide-[var(--border)]/50 bg-[var(--bg-surface)]"
          >
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-base)]">
              Suggestions <span className="font-normal lowercase">([Tab] to complete)</span>
            </div>
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectSuggestion(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-sm transition-colors ${
                  idx === selectedIndex
                    ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.color ? (
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                  ) : item.type === 'directive' ? (
                    <Sparkles size={13} className="text-[var(--accent)]" />
                  ) : item.type === 'operator' ? (
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--accent)] font-bold">
                      OP
                    </span>
                  ) : null}
                  <span className="font-mono font-medium">{item.label}</span>
                </div>
                {item.description && (
                  <span className="text-xs text-[var(--text-muted)] capitalize">
                    {item.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Live Filter Summary & Hints Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-base)] border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium text-[var(--text-primary)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" />
              {matchCount} of {questions.length} question{questions.length !== 1 ? 's' : ''} match
            </span>
            {query.trim() && (
              <button
                onClick={() => handleApply('')}
                className="text-[11px] text-[var(--text-muted)] hover:text-rose-400 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] font-mono text-[10px]">
                Tab
              </kbd>{' '}
              autocomplete
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] font-mono text-[10px]">
                Enter
              </kbd>{' '}
              apply
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] font-mono text-[10px]">
                Esc
              </kbd>{' '}
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

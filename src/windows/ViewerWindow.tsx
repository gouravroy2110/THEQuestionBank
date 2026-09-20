import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Eye, PanelLeftClose, PanelLeftOpen, LayoutGrid,
  LayoutDashboard, ExternalLink, LayoutList, Sparkles
} from 'lucide-react'
import { db } from '../db/schema'
import type { Question, Tag, Project, FilterState, ResolvedQuestion, MetaField } from '../types'
import { QuestionDetail } from '../components/Question/QuestionDetail'
import { QuestionCard } from '../components/Question/QuestionCard'
import { FilterPanel } from '../components/Layout/FilterPanel'
import { SpotlightSearchModal } from '../components/Layout/SpotlightSearchModal'
import { EmptyState, Spinner } from '../components/UI'
import { useBroadcast, broadcast } from '../hooks/useBroadcast'
import { useFilter } from '../hooks/useFilter'

const DEFAULT_FILTER: FilterState = {
  projectId: 'all',
  projectIds: [],
  statuses: [],
  difficulties: [],
  tagIds: [],
  tagMode: 'and',
  textSearch: '',
  metaFilters: [],
  sortBy: 'createdAt',
  sortDir: 'desc',
}

export default function ViewerWindow() {
  const params      = new URLSearchParams(window.location.search)
  const initProject = params.get('project')

  const allQuestions = useLiveQuery(() => db.questions.toArray(), []) ?? []
  const allProjects  = useLiveQuery(() => db.projects.toArray(), []) ?? []
  const allTags      = useLiveQuery(() => db.tags.toArray(), []) ?? []

  const tagMap     = new Map<string, Tag>(allTags.map(t => [t.id, t]))
  const projectMap = new Map<string, Project>(allProjects.map(p => [p.id, p]))

  const [filter, setFilter] = useState<FilterState>({
    ...DEFAULT_FILTER,
    projectId: initProject ?? 'all',
    projectIds: initProject ? [initProject] : [],
  })
  const [activeIndex, setActiveIndex] = useState(0)
  const [filterOpen, setFilterOpen]   = useState(true)
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  const [listMode, setListMode]       = useState<'strip' | 'grid'>('strip')

  // Apply filters
  const filtered = useFilter(allQuestions, filter, tagMap, projectMap)

  // Clamp index when list changes
  useEffect(() => {
    setActiveIndex(i => Math.min(i, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Re-sync when editor saves
  useBroadcast(msg => {
    if (msg.type === 'question:saved') {
      // Dexie live query handles the refresh; no manual action needed
    }
  })

  const activeQuestion = filtered[activeIndex] ?? null

  // Resolve project + effective tags for active question
  const resolvedQuestion: ResolvedQuestion | null = activeQuestion
    ? resolveQuestion(activeQuestion, projectMap, tagMap)
    : null

  const openEditor = () => {
    const url = `${window.location.origin}${window.location.pathname}?window=editor${
      activeQuestion ? `&project=${activeQuestion.projectId ?? ''}` : ''
    }`
    const w = window.open(url, 'mockbank_editor')
    if (activeQuestion && w) {
      // Brief delay so editor has time to mount
      setTimeout(() => {
        broadcast({ type: 'navigate:question', payload: { id: activeQuestion.id } })
      }, 1200)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Toggle spotlight on Tab
      if (e.key === 'Tab') {
        const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
        if (!isInput) {
          e.preventDefault()
          setSpotlightOpen(o => !o)
          return
        }
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'f' || e.key === 'F') setFilterOpen(o => !o)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)] overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
            title="Toggle filters [F]"
          >
            {filterOpen ? <PanelLeftClose size={16}/> : <PanelLeftOpen size={16}/>}
          </button>
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-[var(--accent)]"/>
            <span className="font-display font-semibold text-sm text-[var(--text-primary)]">Viewer</span>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {filtered.length} of {allQuestions.length} question{allQuestions.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpotlightOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
            title="Spotlight Search & SQL Filter [Tab]"
          >
            <Sparkles size={13} className="text-[var(--accent)]" />
            <span className="font-medium">Spotlight</span>
            <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)]">
              Tab
            </kbd>
          </button>

          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setListMode('strip')}
              className={`p-1.5 transition-colors ${listMode === 'strip' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-overlay)]'}`}
              title="List view"
            >
              <LayoutList size={14}/>
            </button>
            <button
              onClick={() => setListMode('grid')}
              className={`p-1.5 transition-colors ${listMode === 'grid' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-overlay)]'}`}
              title="Grid view"
            >
              <LayoutGrid size={14}/>
            </button>
          </div>
          <button
            onClick={() => window.open(window.location.origin + window.location.pathname, 'mockbank_hub')}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
            title="Open Hub"
          >
            <LayoutDashboard size={15}/>
          </button>
          <button
            onClick={openEditor}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-bright)] transition-colors"
          >
            <ExternalLink size={12}/> Open in Editor
          </button>
        </div>
      </header>

      {/* Body — filter sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        {filterOpen && (
          <aside className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] overflow-y-auto">
            <FilterPanel filter={filter} onChange={setFilter} total={filtered.length} />
          </aside>
        )}

        {/* Main content — detail + strip */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {filtered.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<Eye size={36}/>}
                title="No questions match"
                description="Adjust your filters or add more questions in the Editor"
              />
            </div>
          ) : listMode === 'strip' ? (
            /* ── Strip layout: detail on top, list on bottom ── */
            <>
              {/* Detail panel — takes most space */}
              <div className="flex-1 overflow-hidden min-h-0">
                {resolvedQuestion ? (
                  <QuestionDetail
                    question={resolvedQuestion}
                    total={filtered.length}
                    index={activeIndex}
                    onPrev={() => setActiveIndex(i => Math.max(0, i - 1))}
                    onNext={() => setActiveIndex(i => Math.min(filtered.length - 1, i + 1))}
                    onEdit={openEditor}
                  />
                ) : null}
              </div>

              {/* Question strip */}
              {filtered.length > 1 && (
                <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)]">
                  <div className="flex gap-2 px-4 py-2.5 overflow-x-auto">
                    {filtered.map((q, i) => (
                      <QuestionStripItem
                        key={q.id}
                        question={q}
                        active={i === activeIndex}
                        index={i}
                        onClick={() => setActiveIndex(i)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ── Grid layout: all cards, click to detail ── */
            <div className="flex-1 overflow-hidden flex">
              {/* Card grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                  {filtered.map((q, i) => {
                    const project = q.projectId ? projectMap.get(q.projectId) : undefined
                    const tags    = q.tagIds.map(id => tagMap.get(id)).filter((t): t is Tag => !!t)
                    return (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        tags={tags}
                        projectColor={project?.color}
                        active={i === activeIndex}
                        onClick={() => setActiveIndex(i)}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Detail panel on the right in grid mode */}
              {resolvedQuestion && (
                <div className="w-[480px] flex-shrink-0 border-l border-[var(--border)] overflow-hidden">
                  <QuestionDetail
                    question={resolvedQuestion}
                    total={filtered.length}
                    index={activeIndex}
                    onPrev={() => setActiveIndex(i => Math.max(0, i - 1))}
                    onNext={() => setActiveIndex(i => Math.min(filtered.length - 1, i + 1))}
                    onEdit={openEditor}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <SpotlightSearchModal
        isOpen={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        filter={filter}
        onApplyFilter={setFilter}
        projects={allProjects}
        tags={allTags}
        questions={allQuestions}
        tagMap={tagMap}
        projectMap={projectMap}
      />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveQuestion(
  q: Question,
  projectMap: Map<string, Project>,
  tagMap: Map<string, Tag>,
): ResolvedQuestion {
  const project = q.projectId ? projectMap.get(q.projectId) ?? null : null
  const projectTagIds = project?.tagIds ?? []
  const allTagIds     = [...new Set([...projectTagIds, ...q.tagIds])]
  const effectiveTags = allTagIds.map(id => tagMap.get(id)).filter((t): t is Tag => !!t)
  const projectMeta: MetaField[] = project?.metadata ?? []
  const effectiveMetadata = [...projectMeta, ...q.metadata]
  return { ...q, effectiveTags, effectiveMetadata, project }
}

function QuestionStripItem({ question, active, index, onClick }: {
  question: Question
  active: boolean
  index: number
  onClick: () => void
}) {
  const statusDot: Record<string, string> = {
    wrong: 'bg-rose-400', partial: 'bg-amber-400',
    correct: 'bg-emerald-400', unattempted: 'bg-[var(--text-muted)]',
  }
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 rounded-lg border transition-all ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-glow)]'
          : 'border-[var(--border)] hover:border-[var(--border-bright)] hover:bg-[var(--bg-elevated)]'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${statusDot[question.status]}`} />
      <span className="text-[10px] text-[var(--text-muted)] font-mono">{index + 1}</span>
    </button>
  )
}

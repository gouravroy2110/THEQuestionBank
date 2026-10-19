import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus, Search, Trash2, PanelLeftClose, PanelLeftOpen,
  BookOpen, ChevronDown, LayoutDashboard
} from 'lucide-react'
import { db } from '../db/schema'
import { newQuestion, saveQuestion, deleteQuestion } from '../db/questions'
import { getActiveWorkspaceId } from '../db/workspaces'
import type { Question, Tag, Project } from '../types'
import { QuestionForm } from '../components/Question/QuestionForm'
import { QuestionCard } from '../components/Question/QuestionCard'
import { ConfirmDialog, Button, EmptyState, Spinner } from '../components/UI'
import { useBroadcast, broadcast } from '../hooks/useBroadcast'
import { useImageStore } from '../hooks/useImageStore'

export default function EditorWindow() {
  // Read ?project= and ?workspace= param from URL
  const params        = new URLSearchParams(window.location.search)
  const initProject   = params.get('project') ?? null
  const initWorkspace = params.get('workspace') ?? null

  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(initWorkspace)

  useEffect(() => {
    if (!currentWorkspaceId) {
      getActiveWorkspaceId().then(id => setCurrentWorkspaceId(id))
    }
  }, [currentWorkspaceId])

  const currentWorkspace = useLiveQuery(
    () => (currentWorkspaceId ? db.workspaces.get(currentWorkspaceId) : undefined),
    [currentWorkspaceId]
  )

  const allQuestions = useLiveQuery(
    async () => {
      if (currentWorkspaceId) {
        const list = await db.questions.where('workspaceId').equals(currentWorkspaceId).toArray()
        return list.sort((a, b) => b.updatedAt - a.updatedAt)
      } else {
        const list = await db.questions.toArray()
        return list.sort((a, b) => b.updatedAt - a.updatedAt)
      }
    },
    [currentWorkspaceId]
  ) ?? []
  const allProjects  = useLiveQuery(
    () =>
      currentWorkspaceId
        ? db.projects.where('workspaceId').equals(currentWorkspaceId).toArray()
        : db.projects.toArray(),
    [currentWorkspaceId]
  ) ?? []
  const allTags      = useLiveQuery(
    () =>
      currentWorkspaceId
        ? db.tags.where('workspaceId').equals(currentWorkspaceId).toArray()
        : db.tags.toArray(),
    [currentWorkspaceId]
  ) ?? []
  const tagMap       = new Map<string, Tag>(allTags.map(t => [t.id, t]))
  const projectMap   = new Map<string, Project>(allProjects.map(p => [p.id, p]))

  const [activeProjectFilter, setActiveProjectFilter] = useState<string | null>(initProject)
  const [activeId, setActiveId]     = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null)
  const [dirty, setDirty] = useState(false)
  const [pendingNavigate, setPendingNavigate] = useState<string | null>(null)

  const { status: imgStatus, setupDirectory } = useImageStore()

  // Active question object
  const activeQuestion = allQuestions.find(q => q.id === activeId) ?? null

  // Filtered sidebar list
  const sidebarQuestions = allQuestions.filter(q => {
    if (activeProjectFilter && q.projectId !== activeProjectFilter) return false
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const seg = q.questionContent.segments.find(s => s.type === 'markdown')
    const text = seg ? (seg as any).text : ''
    const tagNames = q.tagIds.map(id => tagMap.get(id)?.name || '').join(' ')
    return text.toLowerCase().includes(query) ||
           q.source.toLowerCase().includes(query) ||
           tagNames.toLowerCase().includes(query)
  })

  // Auto-select first question on load
  useEffect(() => {
    if (!activeId && sidebarQuestions.length > 0) {
      setActiveId(sidebarQuestions[0].id)
    }
  }, [sidebarQuestions.length])

  // Listen for navigate:question and workspace:switched from other windows
  useBroadcast(msg => {
    if (msg.type === 'navigate:question') {
      navigateTo(msg.payload.id)
    } else if (msg.type === 'workspace:switched') {
      setCurrentWorkspaceId(msg.payload.id)
      setActiveId(null)
    }
  })

  const navigateTo = (id: string) => {
    if (dirty) { setPendingNavigate(id); return }
    setActiveId(id)
  }

  const handleNewQuestion = useCallback(() => {
    const q = newQuestion(activeProjectFilter, currentWorkspaceId ?? undefined)
    setActiveId(q.id)
    saveQuestion(q).then(() => {
      broadcast({ type: 'question:saved', payload: { id: q.id, projectId: q.projectId } })
    })
    setDirty(false)
  }, [activeProjectFilter, currentWorkspaceId])

  const handleSaved = useCallback((q: Question) => {
    setActiveId(q.id)
    setDirty(false)
    broadcast({ type: 'question:saved', payload: { id: q.id, projectId: q.projectId } })
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteQuestion(deleteTarget.id)
    broadcast({ type: 'question:deleted', payload: { id: deleteTarget.id } })
    if (activeId === deleteTarget.id) {
      const remaining = sidebarQuestions.filter(q => q.id !== deleteTarget.id)
      setActiveId(remaining[0]?.id ?? null)
    }
    setDeleteTarget(null)
  }

  // Ctrl+N global
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); handleNewQuestion() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNewQuestion])

  const currentProject = activeProjectFilter ? projectMap.get(activeProjectFilter) : null

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)] overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose size={16}/> : <PanelLeftOpen size={16}/>}
          </button>
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-[var(--accent)]" />
            <span className="font-display font-semibold text-sm text-[var(--text-primary)]">
              Editor
              {currentWorkspace && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-normal border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                  {currentWorkspace.name}
                </span>
              )}
              {currentProject && (
                <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                  — {currentProject.name}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {imgStatus !== 'ready' && (
            <button
              onClick={setupDirectory}
              className="text-xs text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-lg hover:border-amber-400 transition-colors"
            >
              Set image folder
            </button>
          )}
          <button
            onClick={() => window.open(window.location.origin + window.location.pathname, 'mockbank_hub')}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
            title="Open Hub"
          >
            <LayoutDashboard size={15}/>
          </button>
          <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={handleNewQuestion}>
            New <span className="text-white/50 text-[10px] ml-1">Ctrl+N</span>
          </Button>
        </div>
      </header>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Collapsible question list sidebar ── */}
        {sidebarOpen && (
          <aside className="w-72 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col flex-shrink-0">
            {/* Search + filter */}
            <div className="p-3 border-b border-[var(--border)] space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
                <input
                  className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  placeholder="Search questions…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Project filter dropdown */}
              {allProjects.length > 0 && (
                <div className="relative">
                  <select
                    className="w-full text-xs px-2.5 py-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-muted)] appearance-none cursor-pointer focus:outline-none pr-6"
                    value={activeProjectFilter ?? ''}
                    onChange={e => setActiveProjectFilter(e.target.value || null)}
                  >
                    <option value="">All Projects</option>
                    {allProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-2 pointer-events-none text-[var(--text-muted)]" />
                </div>
              )}
            </div>

            {/* Questions count */}
            <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
              {sidebarQuestions.length} question{sidebarQuestions.length !== 1 ? 's' : ''}
            </div>

            {/* Question items */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
              {sidebarQuestions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                  {searchQuery ? 'No matching questions' : 'No questions yet'}
                </div>
              ) : (
                sidebarQuestions.map(q => {
                  const isSelected = q.id === activeId
                  const seg = q.questionContent.segments.find(s => s.type === 'markdown')
                  const rawText = seg ? (seg as any).text.trim() : ''
                  const displayTitle = rawText ? rawText.slice(0, 60) : (q.source || `Question #${q.id.slice(0, 6)}`)
                  const directTags = q.tagIds.map(tId => tagMap.get(tId)).filter((t): t is Tag => !!t)
                  const hasImages = q.questionContent.segments.some(s => s.type === 'image')

                  return (
                    <div
                      key={q.id}
                      onClick={() => navigateTo(q.id)}
                      className={`group flex items-start gap-2 p-3 cursor-pointer transition-colors relative ${
                        isSelected
                          ? 'bg-[var(--accent-dim)] border-l-2 border-[var(--accent)]'
                          : 'hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs truncate ${isSelected ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                            {displayTitle}
                          </p>
                          {hasImages && (
                            <span className="flex-shrink-0 text-[9px] px-1 py-0.2 rounded border border-sky-500/30 text-sky-400 bg-sky-500/10 font-mono">
                              IMG
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              q.status === 'correct' ? 'bg-emerald-400' :
                              q.status === 'wrong'   ? 'bg-rose-400' :
                              q.status === 'partial' ? 'bg-amber-400' : 'bg-zinc-500'
                            }`}
                          />
                          <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono">{q.status}</span>
                          {q.questionType && q.questionType !== 'none' && (
                            <span className="text-[9px] text-[var(--text-muted)] border border-[var(--border)] px-1 rounded uppercase font-mono">
                              {q.questionType}
                            </span>
                          )}
                          {directTags.slice(0, 2).map(t => (
                            <span
                              key={t.id}
                              className="text-[9px] px-1.5 py-0.2 rounded-full border truncate max-w-[85px]"
                              style={{
                                color: t.color,
                                borderColor: `${t.color}35`,
                                background: `${t.color}12`,
                              }}
                            >
                              {t.name}
                            </span>
                          ))}
                          {directTags.length > 2 && (
                            <span className="text-[9px] text-[var(--text-muted)]">
                              +{directTags.length - 2}
                            </span>
                          )}
                          {q.source && rawText && (
                            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px] font-mono">
                              · {q.source}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(q) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-all flex-shrink-0 mt-0.5"
                        title="Delete question"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </aside>
        )}

        {/* ── Main editor area ── */}
        <main className="flex-1 overflow-hidden">
          {activeQuestion ? (
            <QuestionForm
              key={activeQuestion.id}
              question={activeQuestion}
              workspaceId={currentWorkspaceId ?? undefined}
              onSaved={handleSaved}
              onChanged={() => setDirty(true)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={<BookOpen size={36}/>}
                title="No question selected"
                description="Select a question from the sidebar or create a new one"
                action={
                  <Button variant="primary" size="md" icon={<Plus size={14}/>} onClick={handleNewQuestion}>
                    New Question
                  </Button>
                }
              />
            </div>
          )}
        </main>
      </div>

      {/* Unsaved-changes guard */}
      <ConfirmDialog
        open={!!pendingNavigate}
        title="Unsaved Changes"
        message="You have unsaved changes. Discard them and navigate away?"
        confirmLabel="Discard & Navigate"
        danger
        onConfirm={() => {
          setActiveId(pendingNavigate)
          setDirty(false)
          setPendingNavigate(null)
        }}
        onCancel={() => setPendingNavigate(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Question"
        message="Permanently delete this question? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

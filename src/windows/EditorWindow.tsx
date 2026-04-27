import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus, Search, Trash2, PanelLeftClose, PanelLeftOpen,
  BookOpen, ChevronDown, LayoutDashboard
} from 'lucide-react'
import { db } from '../db/schema'
import { newQuestion, saveQuestion, deleteQuestion } from '../db/questions'
import { getAllTags } from '../db/tags'
import type { Question, Tag, Project } from '../types'
import { QuestionForm } from '../components/Question/QuestionForm'
import { QuestionCard } from '../components/Question/QuestionCard'
import { ConfirmDialog, Button, EmptyState, Spinner } from '../components/UI'
import { useBroadcast, broadcast } from '../hooks/useBroadcast'
import { useImageStore } from '../hooks/useImageStore'

export default function EditorWindow() {
  // Read ?project= param from URL
  const params      = new URLSearchParams(window.location.search)
  const initProject = params.get('project') ?? null

  const allQuestions = useLiveQuery(() => db.questions.orderBy('updatedAt').reverse().toArray(), []) ?? []
  const allProjects  = useLiveQuery(() => db.projects.toArray(), []) ?? []
  const allTags      = useLiveQuery(() => db.tags.toArray(), []) ?? []
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
    const seg = q.questionContent.segments.find(s => s.type === 'markdown')
    const text = seg ? (seg as any).text : ''
    return text.toLowerCase().includes(searchQuery.toLowerCase()) ||
           q.source.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Auto-select first question on load
  useEffect(() => {
    if (!activeId && sidebarQuestions.length > 0) {
      setActiveId(sidebarQuestions[0].id)
    }
  }, [sidebarQuestions.length])

  // Listen for navigate:question from viewer
  useBroadcast(msg => {
    if (msg.type === 'navigate:question') {
      navigateTo(msg.payload.id)
    }
  })

  const navigateTo = (id: string) => {
    if (dirty) { setPendingNavigate(id); return }
    setActiveId(id)
  }

  const handleNewQuestion = useCallback(() => {
    const q = newQuestion(activeProjectFilter)
    // Don't save yet — just set as active draft
    setActiveId(q.id)
    // We need to pre-insert so form can work; save immediately as blank
    saveQuestion(q).then(() => {
      broadcast({ type: 'question:saved', payload: { id: q.id, projectId: q.projectId } })
    })
    setDirty(false)
  }, [activeProjectFilter])

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
            onClick={() => window.open(window.location.origin + window.location.pathname, '_blank')}
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

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <aside className="w-72 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col overflow-hidden">
            {/* Project picker */}
            <div className="px-3 pt-3 pb-2 border-b border-[var(--border)]">
              <select
                className="w-full px-2.5 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                value={activeProjectFilter ?? ''}
                onChange={e => setActiveProjectFilter(e.target.value || null)}
              >
                <option value="">All Questions</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-[var(--border)]">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"/>
                <input
                  className="w-full pl-7 pr-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  placeholder="Search questions…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Count */}
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">
                {sidebarQuestions.length} question{sidebarQuestions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
              {sidebarQuestions.length === 0 ? (
                <EmptyState
                  icon={<BookOpen size={24}/>}
                  title="No questions"
                  description="Click New to add one"
                />
              ) : (
                sidebarQuestions.map(q => {
                  const project = q.projectId ? projectMap.get(q.projectId) : undefined
                  const tags = q.tagIds.map(id => tagMap.get(id)).filter((t): t is Tag => !!t)
                  return (
                    <div key={q.id} className="group relative">
                      <QuestionCard
                        question={q}
                        tags={tags}
                        projectColor={project?.color}
                        active={q.id === activeId}
                        onClick={() => navigateTo(q.id)}
                      />
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(q) }}
                        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <Trash2 size={11}/>
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

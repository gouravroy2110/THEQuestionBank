import React, { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  FolderTree, Plus, Search, Tag as TagIcon, Sparkles,
  Layers, ExternalLink, BookOpen, Eye, LayoutDashboard,
  HelpCircle, ArrowDownToLine
} from 'lucide-react'
import { db } from '../db/schema'
import { Tag } from '../types'
import { getActiveWorkspaceId, setActiveWorkspaceId } from '../db/workspaces'
import { createTag, TAG_PALETTE } from '../db/tags'
import { WorkspaceSidebar } from '../components/Workspace/WorkspaceSidebar'
import { CircularWorkspaceSwitcher } from '../components/Workspace/CircularWorkspaceSwitcher'
import { TagHierarchyTree } from '../components/Tags/TagHierarchyTree'
import { WorkspaceModal } from '../components/Workspace/WorkspaceModal'
import { Button, Modal } from '../components/UI'
import { useBroadcast, broadcast } from '../hooks/useBroadcast'

export default function TagsWindow() {
  const params = new URLSearchParams(window.location.search)
  const initWorkspace = params.get('workspace')

  const [activeWsId, setActiveWsId] = useState<string>(initWorkspace ?? 'default-workspace')
  const [circularSwitcherOpen, setCircularSwitcherOpen] = useState(false)
  const [newWsModalOpen, setNewWsModalOpen] = useState(false)
  const [newTagModalOpen, setNewTagModalOpen] = useState(false)

  // New Tag form state
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0])
  const [newTagParentId, setNewTagParentId] = useState<string>('')

  // Search filter
  const [search, setSearch] = useState('')
  const [columns, setColumns] = useState<2 | 3>(3)

  useEffect(() => {
    if (!initWorkspace) {
      getActiveWorkspaceId().then(setActiveWsId)
    }
  }, [initWorkspace])

  const currentWorkspace = useLiveQuery(
    () => (activeWsId ? db.workspaces.get(activeWsId) : undefined),
    [activeWsId]
  )

  const allTags = useLiveQuery(
    () => (activeWsId ? db.tags.where('workspaceId').equals(activeWsId).toArray() : db.tags.toArray()),
    [activeWsId]
  ) ?? []

  const projects = useLiveQuery(
    () => (activeWsId ? db.projects.where('workspaceId').equals(activeWsId).toArray() : db.projects.toArray()),
    [activeWsId]
  ) ?? []

  const projectTagIdSet = useMemo(() => {
    return new Set(projects.flatMap(p => p.tagIds))
  }, [projects])

  // Exclude project-level tags from the tag hierarchy editor
  const nonProjectTags = useMemo(() => {
    return (allTags as Tag[]).filter((t: Tag) => !t.isProjectTag && !t.projectId && !projectTagIdSet.has(t.id))
  }, [allTags, projectTagIdSet])

  const questionCounts = useLiveQuery(async () => {
    const list = activeWsId
      ? await db.questions.where('workspaceId').equals(activeWsId).toArray()
      : await db.questions.toArray()
    const counts: Record<string, number> = {}
    for (const q of list) {
      q.tagIds.forEach(tId => {
        counts[tId] = (counts[tId] || 0) + 1
      })
    }
    return counts
  }, [activeWsId]) ?? {}

  // Sync across windows
  useBroadcast(msg => {
    if (msg.type === 'workspace:switched') {
      setActiveWsId(msg.payload.id)
    }
  })

  const handleSelectWorkspace = async (id: string) => {
    setActiveWsId(id)
    await setActiveWorkspaceId(id)
    broadcast({ type: 'workspace:switched', payload: { id } })
  }

  // Keyboard shortcut: Tab opens Circular Switcher
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
        if (!isInput) {
          e.preventDefault()
          setCircularSwitcherOpen(o => !o)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleCreateTopTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagName.trim()) return

    await createTag(
      newTagName.trim(),
      null,
      activeWsId,
      newTagParentId || null,
      newTagColor
    )
    broadcast({ type: 'tags:changed', payload: {} })
    setNewTagName('')
    setNewTagParentId('')
    setNewTagModalOpen(false)
  }

  const rootTags = nonProjectTags.filter((t: Tag) => !t.parentId)
  const childTags = nonProjectTags.filter((t: Tag) => !!t.parentId)

  return (
    <div className="h-screen flex bg-[var(--bg-base)] overflow-hidden">
      {/* ── Left Pane: Workspaces Sidebar ── */}
      <WorkspaceSidebar
        activeWorkspaceId={activeWsId}
        onSelectWorkspace={handleSelectWorkspace}
        onOpenCircularSwitcher={() => setCircularSwitcherOpen(true)}
        currentWindow="tags"
      />

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shadow-sm">
              <FolderTree size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-base text-[var(--text-primary)] leading-tight">
                  Tag Hierarchy Editor
                </h1>
                {currentWorkspace && (
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-medium border border-[var(--border)] text-[var(--text-secondary)] flex items-center gap-1.5"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: currentWorkspace.color || '#0078d4' }}
                    />
                    {currentWorkspace.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Organize sub-categories via visual drag-and-drop
              </p>
            </div>
          </div>

          {/* Top actions */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search tags…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-52 transition-all"
              />
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => {
                setNewTagName('')
                setNewTagParentId('')
                setNewTagColor(TAG_PALETTE[0])
                setNewTagModalOpen(true)
              }}
            >
              New Tag
            </Button>

            {/* Columns layout toggle */}
            <div className="flex items-center p-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
              <button
                type="button"
                onClick={() => setColumns(2)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  columns === 2 ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'hover:text-[var(--text-primary)]'
                }`}
                title="2 Columns"
              >
                2 Cols
              </button>
              <button
                type="button"
                onClick={() => setColumns(3)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  columns === 3 ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'hover:text-[var(--text-primary)]'
                }`}
                title="3 Columns"
              >
                3 Cols
              </button>
            </div>

            <div className="h-4 w-px bg-[var(--border)] mx-1" />

            <button
              onClick={() =>
                window.open(
                  `${window.location.origin}${window.location.pathname}?window=viewer&workspace=${activeWsId}`,
                  'mockbank_viewer'
                )
              }
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
              title="Open Viewer"
            >
              <Eye size={15} />
            </button>

            <button
              onClick={() =>
                window.open(
                  `${window.location.origin}${window.location.pathname}`,
                  'mockbank_hub'
                )
              }
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
              title="Open MockBank Hub"
            >
              <LayoutDashboard size={15} />
            </button>
          </div>
        </header>

        {/* Workspace Tag Stats bar */}
        <div className="px-6 py-2.5 bg-[var(--bg-elevated)]/50 border-b border-[var(--border)]/60 flex items-center justify-between text-xs text-[var(--text-muted)] flex-shrink-0">
          <div className="flex items-center gap-6">
            <span>
              Total Tags: <strong className="text-[var(--text-primary)]">{nonProjectTags.length}</strong>
            </span>
            <span>
              Root Categories: <strong className="text-[var(--text-primary)]">{rootTags.length}</strong>
            </span>
            <span>
              Sub-tags: <strong className="text-[var(--text-primary)]">{childTags.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <Sparkles size={12} className="text-amber-400" />
            <span>Drag a tag onto another to nest it • Drag to top bar to unparent</span>
          </div>
        </div>

        {/* Main Tree Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
          <TagHierarchyTree
            tags={nonProjectTags}
            workspaceId={activeWsId}
            searchQuery={search}
            questionCounts={questionCounts}
            columns={columns}
          />
        </div>
      </div>

      {/* ── Circular Switcher Overlay (Tab HUD) ── */}
      <CircularWorkspaceSwitcher
        open={circularSwitcherOpen}
        onClose={() => setCircularSwitcherOpen(false)}
        activeWorkspaceId={activeWsId}
        onSelectWorkspace={handleSelectWorkspace}
        onOpenNewWorkspaceModal={() => setNewWsModalOpen(true)}
      />

      {/* New Workspace Modal */}
      <WorkspaceModal
        open={newWsModalOpen}
        onClose={() => setNewWsModalOpen(false)}
        onSave={ws => {
          handleSelectWorkspace(ws.id)
        }}
      />

      {/* Create Tag Modal */}
      <Modal
        open={newTagModalOpen}
        onClose={() => setNewTagModalOpen(false)}
        title="Create New Tag"
        width="max-w-md"
      >
        <form onSubmit={handleCreateTopTag} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Tag Name
            </label>
            <input
              type="text"
              placeholder="e.g. Asynchronous Circuits, Linear Algebra..."
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              autoFocus
              required
              className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Parent Category (Optional)
            </label>
            <select
              value={newTagParentId}
              onChange={e => setNewTagParentId(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">None (Top-Level Category)</option>
              {allTags.map(t => (
                <option key={t.id} value={t.id}>
                  {t.parentId ? `↳ ${t.name}` : t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {TAG_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    newTagColor === c ? 'border-white scale-110 shadow-sm' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button type="button" variant="ghost" size="sm" onClick={() => setNewTagModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={!newTagName.trim()}>
              Create Tag
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

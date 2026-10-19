import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus, Search, Edit2, Trash2, FolderTree, Tag as TagIcon,
  Check, ExternalLink, Layers, Sparkles
} from 'lucide-react'
import { db } from '../../db/schema'
import type { Workspace } from '../../types'
import { WorkspaceModal } from './WorkspaceModal'
import { ConfirmDialog, Button } from '../UI'
import { deleteWorkspace } from '../../db/workspaces'

interface Props {
  activeWorkspaceId: string
  onSelectWorkspace: (id: string) => void
  onOpenCircularSwitcher?: () => void
  currentWindow?: 'hub' | 'tags'
}

export function WorkspaceSidebar({
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenCircularSwitcher,
  currentWindow = 'hub',
}: Props) {
  const workspaces = useLiveQuery(() => db.workspaces.toArray(), []) ?? []
  const questionCounts = useLiveQuery(async () => {
    const list = await db.questions.toArray()
    const counts: Record<string, number> = {}
    for (const q of list) {
      const ws = q.workspaceId || 'default-workspace'
      counts[ws] = (counts[ws] || 0) + 1
    }
    return counts
  }, []) ?? {}

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Workspace | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)

  const filteredWorkspaces = useMemo(() => {
    if (!search.trim()) return workspaces
    const q = search.trim().toLowerCase()
    return workspaces.filter(w => w.name.toLowerCase().includes(q))
  }, [workspaces, search])

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await deleteWorkspace(deleteTarget.id)
    if (res.success) {
      const remaining = workspaces.find(w => w.id !== deleteTarget.id)
      if (remaining && activeWorkspaceId === deleteTarget.id) {
        onSelectWorkspace(remaining.id)
      }
    }
    setDeleteTarget(null)
  }

  const openTagEditor = () => {
    const url = `${window.location.origin}${window.location.pathname}?window=tags&workspace=${activeWorkspaceId}`
    window.open(url, 'mockbank_tags')
  }

  const openHub = () => {
    const url = `${window.location.origin}${window.location.pathname}`
    window.open(url, 'mockbank_hub')
  }

  return (
    <aside className="w-64 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col flex-shrink-0 h-full select-none">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-[var(--border)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-[var(--accent)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Workspaces
            </h2>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] font-mono">
              {workspaces.length}
            </span>
          </div>

          <button
            onClick={() => {
              setEditTarget(null)
              setModalOpen(true)
            }}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Create Workspace"
          >
            <Plus size={15} />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
          <input
            type="text"
            className="w-full pl-7 pr-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            placeholder="Search workspaces…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Workspaces List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]/30 p-2 space-y-1">
        {filteredWorkspaces.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text-muted)]">
            {search ? 'No matching workspace' : 'No workspaces'}
          </div>
        ) : (
          filteredWorkspaces.map(w => {
            const isActive = w.id === activeWorkspaceId
            const count = questionCounts[w.id] ?? 0
            const dotColor = w.color || '#0078d4'

            return (
              <div
                key={w.id}
                onClick={() => onSelectWorkspace(w.id)}
                className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[var(--accent-dim)] text-[var(--text-primary)] font-medium shadow-sm border border-[var(--accent)]/30'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: dotColor }}
                  />
                  <span className="text-xs truncate">{w.name}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-base)]/50 border border-[var(--border)]/40">
                    {count}
                  </span>

                  {/* Actions on hover */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setEditTarget(w)
                        setModalOpen(true)
                      }}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"
                      title="Rename Workspace"
                    >
                      <Edit2 size={11} />
                    </button>

                    {workspaces.length > 1 && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setDeleteTarget(w)
                        }}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10"
                        title="Delete Workspace"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Bottom Section */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-elevated)]/40 space-y-2">
        {/* Quick Switcher shortcut hint */}
        {onOpenCircularSwitcher && (
          <button
            type="button"
            onClick={onOpenCircularSwitcher}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--border-bright)] transition-colors text-xs text-[var(--text-secondary)]"
            title="Open Circular Switcher (Tab)"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-amber-400" />
              <span>Quick Switcher</span>
            </div>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)]">
              Tab
            </kbd>
          </button>
        )}

        {/* Dedicated Tag Editor Button (Prominent & Larger) */}
        {currentWindow !== 'tags' ? (
          <button
            type="button"
            onClick={openTagEditor}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-overlay)] hover:border-[var(--accent)] transition-all group shadow-sm text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                <FolderTree size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                  Tag Editor
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Hierarchy & sub-tags
                </p>
              </div>
            </div>
            <ExternalLink size={13} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={openHub}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-overlay)] hover:border-[var(--accent)] transition-all group shadow-sm text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                <Layers size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                  MockBank Hub
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Home screen & projects
                </p>
              </div>
            </div>
            <ExternalLink size={13} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0" />
          </button>
        )}
      </div>

      {/* Workspace Create / Edit Modal */}
      <WorkspaceModal
        open={modalOpen}
        workspace={editTarget}
        onClose={() => {
          setModalOpen(false)
          setEditTarget(null)
        }}
        onSave={saved => {
          onSelectWorkspace(saved.id)
        }}
      />

      {/* Workspace Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Workspace"
        message={`Delete "${deleteTarget?.name}"? Questions and projects in this workspace will be unlinked or removed.`}
        confirmLabel="Delete Workspace"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </aside>
  )
}

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus, Edit2, Trash2, ExternalLink, BookOpen,
  FolderOpen, HardDrive, Layers, Download, Tag as TagIcon,
  Check, Sparkles, FolderTree
} from 'lucide-react'
import { db } from '../db/schema'
import { deleteProject } from '../db/projects'
import { useImageStore } from '../hooks/useImageStore'
import { ProjectForm } from '../components/Project/ProjectForm'
import { ExportImportModal } from '../components/Layout/ExportImportModal'
import { WorkspaceSidebar } from '../components/Workspace/WorkspaceSidebar'
import { CircularWorkspaceSwitcher } from '../components/Workspace/CircularWorkspaceSwitcher'
import { WorkspaceModal } from '../components/Workspace/WorkspaceModal'
import { Button, ConfirmDialog, EmptyState } from '../components/UI'
import type { Project, Workspace } from '../types'
import { broadcast, useBroadcast } from '../hooks/useBroadcast'
import { findOrphanedImages, getImageDirHandle } from '../db/images'
import {
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  ensureDefaultWorkspace
} from '../db/workspaces'

export default function Hub() {
  const [activeWsId, setActiveWsId] = useState<string>('default-workspace')
  const [circularSwitcherOpen, setCircularSwitcherOpen] = useState(false)
  const [newWsModalOpen, setNewWsModalOpen] = useState(false)

  // Ensure initial active workspace is loaded
  useEffect(() => {
    ensureDefaultWorkspace().then(def => {
      getActiveWorkspaceId().then(id => setActiveWsId(id || def.id))
    })
  }, [])

  // Listen for broadcast sync
  useBroadcast(msg => {
    if (msg.type === 'workspace:switched') {
      setActiveWsId(msg.payload.id)
    }
  })

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

  // Queries scoped to active workspace
  const workspaces = useLiveQuery(() => db.workspaces.orderBy('createdAt').toArray(), []) ?? []
  const currentWorkspace = workspaces.find(w => w.id === activeWsId) ?? workspaces[0]

  const projects = useLiveQuery(
    () => db.projects.where('workspaceId').equals(activeWsId).reverse().sortBy('createdAt'),
    [activeWsId]
  ) ?? []

  const qCount = useLiveQuery(
    () => db.questions.where('workspaceId').equals(activeWsId).count(),
    [activeWsId]
  ) ?? 0

  const recentQs = useLiveQuery(
    async () => {
      const all = await db.questions.where('workspaceId').equals(activeWsId).reverse().sortBy('updatedAt')
      return all.slice(0, 5)
    },
    [activeWsId]
  ) ?? []

  const { status: imgStatus, setupDirectory } = useImageStore()

  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [editTarget, setEditTarget]           = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget]       = useState<Project | null>(null)
  const [exportOpen, setExportOpen]           = useState(false)
  const [orphans, setOrphans]                 = useState<string[] | null>(null)
  const [cleaningUp, setCleaningUp]           = useState(false)

  const scanOrphans = async () => {
    setCleaningUp(true)
    const list = await findOrphanedImages()
    setOrphans(list)
    setCleaningUp(false)
  }

  const deleteOrphans = async () => {
    if (!orphans) return
    const handle = await getImageDirHandle()
    if (!handle) return
    setCleaningUp(true)
    for (const filename of orphans) {
      try { await handle.removeEntry(filename) } catch {}
    }
    setOrphans(null)
    setCleaningUp(false)
  }

  const openEditor = (projectId?: string) => {
    const url = `${window.location.origin}${window.location.pathname}?window=editor&workspace=${activeWsId}${projectId ? `&project=${projectId}` : ''}`
    window.open(url, 'mockbank_editor')
  }

  const openViewer = (projectId?: string) => {
    const url = `${window.location.origin}${window.location.pathname}?window=viewer&workspace=${activeWsId}${projectId ? `&project=${projectId}` : ''}`
    window.open(url, 'mockbank_viewer')
  }

  const openTagEditor = () => {
    const url = `${window.location.origin}${window.location.pathname}?window=tags&workspace=${activeWsId}`
    window.open(url, 'mockbank_tags')
  }

  const handleSwitchWorkspace = async (id: string) => {
    setActiveWsId(id)
    await setActiveWorkspaceId(id)
    broadcast({ type: 'workspace:switched', payload: { id } })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteProject(deleteTarget.id)
    broadcast({ type: 'project:deleted', payload: { id: deleteTarget.id } })
    setDeleteTarget(null)
  }

  return (
    <div className="h-screen flex bg-[var(--bg-base)] overflow-hidden">
      {/* ── Left Pane: Workspace Sidebar ── */}
      <WorkspaceSidebar
        activeWorkspaceId={activeWsId}
        onSelectWorkspace={handleSwitchWorkspace}
        onOpenCircularSwitcher={() => setCircularSwitcherOpen(true)}
        currentWindow="hub"
      />

      {/* ── Main Hub View ── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top nav */}
        <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 z-20 flex-shrink-0">
          <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center shadow-sm">
                <BookOpen size={16} className="text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-base text-[var(--text-primary)] leading-none">MockBank</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-[var(--text-muted)]">Workspace:</span>
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: currentWorkspace?.color || '#0078d4' }}
                  />
                  <span className="text-[10px] font-medium text-[var(--text-primary)]">
                    {currentWorkspace?.name || 'Default Workspace'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost"
                size="sm"
                icon={<FolderTree size={13} />}
                onClick={openTagEditor}
                title="Open Tag Hierarchy Editor in new tab"
              >
                Tag Editor
              </Button>
              <Button variant="ghost" size="sm" icon={<Download size={13}/>} onClick={() => setExportOpen(true)}>
                Export / Import
              </Button>
              <Button variant="ghost" size="sm" icon={<ExternalLink size={13}/>} onClick={() => openViewer()}>
                Open Viewer
              </Button>
              <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={() => openEditor()}>
                New Question
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8 space-y-10 w-full">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Questions" value={qCount} color="var(--accent)" />
            <StatCard label="Projects" value={projects.length} color="#10b981" />
            <StatCard
              label="Image Store"
              value={imgStatus === 'ready' ? 'Ready' : 'Not Set'}
              color={imgStatus === 'ready' ? '#10b981' : '#f59e0b'}
              isText
            />
          </div>

          {/* Image store setup */}
          {imgStatus !== 'ready' && (
            <div className="flex items-start gap-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
              <HardDrive size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-300">Image Storage Not Configured</p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  {imgStatus === 'permission-denied'
                    ? 'Permission was denied. Click to retry.'
                    : 'Choose a folder on your computer to store question images.'}
                </p>
              </div>
              <Button size="sm" variant="outline" icon={<FolderOpen size={13}/>} onClick={setupDirectory}
                className="border-amber-500/40 text-amber-400 hover:border-amber-400 flex-shrink-0">
                Choose Folder
              </Button>
            </div>
          )}

          {/* Projects */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-semibold text-base text-[var(--text-primary)]">Projects</h2>
                <span className="text-xs text-[var(--text-muted)]">
                  in <strong className="text-[var(--text-secondary)]">{currentWorkspace?.name}</strong>
                </span>
              </div>
              <Button size="sm" variant="outline" icon={<Plus size={12}/>}
                onClick={() => { setEditTarget(null); setProjectFormOpen(true) }}>
                New Project
              </Button>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                icon={<Layers size={32}/>}
                title="No projects in this workspace"
                description="Projects help you organise questions from different mock tests"
                action={
                  <Button variant="primary" size="sm" icon={<Plus size={13}/>}
                    onClick={() => setProjectFormOpen(true)}>
                    Create First Project
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {projects.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onEdit={() => { setEditTarget(p); setProjectFormOpen(true) }}
                    onDelete={() => setDeleteTarget(p)}
                    onOpenEditor={() => openEditor(p.id)}
                    onOpenViewer={() => openViewer(p.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Recent Activity */}
          <section>
            <h2 className="font-display font-semibold text-base text-[var(--text-primary)] mb-4">
              Recent Activity
            </h2>
            {recentQs.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">
                No recent activity in this workspace.
              </div>
            ) : (
              <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)] bg-[var(--bg-elevated)]">
                {recentQs.map(q => {
                  const seg = q.questionContent.segments.find(s => s.type === 'markdown')
                  const text = seg ? (seg as any).text.slice(0, 80) : '[Image only]'
                  return (
                    <div
                      key={q.id}
                      onClick={() => openEditor(q.projectId ?? undefined)}
                      className="flex items-center justify-between p-3.5 hover:bg-[var(--bg-overlay)] transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            q.status === 'correct' ? 'bg-emerald-400' :
                            q.status === 'wrong'   ? 'bg-rose-400' :
                            q.status === 'partial' ? 'bg-amber-400' : 'bg-zinc-500'
                          }`}
                        />
                        <span className="text-[var(--text-primary)] truncate font-mono">{text}</span>
                      </div>
                      <span className="text-[var(--text-muted)] text-[11px] font-mono flex-shrink-0 ml-4">
                        {new Date(q.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Maintenance / Image Cleanup */}
          <section className="pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Image Store</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage and cleanup unreferenced images on disk</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={setupDirectory}>
                  Change Folder
                </Button>
                <Button size="sm" variant="outline" loading={cleaningUp} onClick={scanOrphans}>
                  Scan Unused Images
                </Button>
              </div>
            </div>

            {orphans !== null && (
              <div className="mt-3 p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">
                  {orphans.length === 0
                    ? 'No orphaned images found.'
                    : `Found ${orphans.length} unused image file${orphans.length !== 1 ? 's' : ''}.`}
                </span>
                {orphans.length > 0 && (
                  <Button size="sm" variant="danger" icon={<Trash2 size={12}/>} onClick={deleteOrphans}>
                    Delete {orphans.length} Unused
                  </Button>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* ── Circular Switcher (Tab HUD) ── */}
      <CircularWorkspaceSwitcher
        open={circularSwitcherOpen}
        onClose={() => setCircularSwitcherOpen(false)}
        activeWorkspaceId={activeWsId}
        onSelectWorkspace={handleSwitchWorkspace}
        onOpenNewWorkspaceModal={() => setNewWsModalOpen(true)}
      />

      {/* ── Workspace Create Modal ── */}
      <WorkspaceModal
        open={newWsModalOpen}
        onClose={() => setNewWsModalOpen(false)}
        onSave={ws => {
          handleSwitchWorkspace(ws.id)
        }}
      />

      {/* Project Form Modal */}
      <ProjectForm
        open={projectFormOpen}
        project={editTarget}
        workspaceId={activeWsId}
        onClose={() => setProjectFormOpen(false)}
        onSaved={p => {
          setProjectFormOpen(false)
          setEditTarget(null)
        }}
      />

      {/* Export / Import Modal */}
      <ExportImportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        activeWorkspace={currentWorkspace}
      />

      {/* Delete Project Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Project"
        message={`Delete "${deleteTarget?.name}"? Questions in this project won't be deleted — they'll become unassigned.`}
        confirmLabel="Delete Project"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function StatCard({ label, value, color, isText }: {
  label: string
  value: number | string
  color: string
  isText?: boolean
}) {
  return (
    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
      <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-display font-bold text-2xl" style={{ color }}>
        {isText ? value : (value as number).toLocaleString()}
      </p>
    </div>
  )
}

function ProjectCard({ project, onEdit, onDelete, onOpenEditor, onOpenViewer }: {
  project: Project
  onEdit: () => void
  onDelete: () => void
  onOpenEditor: () => void
  onOpenViewer: () => void
}) {
  const qCount = useLiveQuery(() => db.questions.where('projectId').equals(project.id).count(), [project.id]) ?? 0

  return (
    <div
      className="group relative flex flex-col justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--border-bright)] transition-all"
      style={{ borderTop: `3px solid ${project.color}` }}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] leading-snug">
            {project.name}
          </h3>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={onEdit} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]">
              <Edit2 size={12} />
            </button>
            <button onClick={onDelete} className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {project.description && (
          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{project.description}</p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)] font-mono">
          {qCount} question{qCount !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onOpenEditor}
            className="px-2 py-1 text-[11px] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
          >
            + Editor
          </button>
          <button
            onClick={onOpenViewer}
            className="px-2 py-1 text-[11px] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
          >
            Viewer
          </button>
        </div>
      </div>
    </div>
  )
}

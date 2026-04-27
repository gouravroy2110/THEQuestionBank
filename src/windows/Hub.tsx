import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus, Edit2, Trash2, ExternalLink, BookOpen,
  FolderOpen, HardDrive, Layers, Download, Trash
} from 'lucide-react'
import { db } from '../db/schema'
import { deleteProject } from '../db/projects'
import { useImageStore } from '../hooks/useImageStore'
import { ProjectForm } from '../components/Project/ProjectForm'
import { ExportImportModal } from '../components/Layout/ExportImportModal'
import { Button, ConfirmDialog, EmptyState } from '../components/UI'
import type { Project } from '../types'
import { broadcast } from '../hooks/useBroadcast'
import { findOrphanedImages } from '../db/images'
import { getImageDirHandle } from '../db/images'

export default function Hub() {
  const projects  = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), []) ?? []
  const qCount    = useLiveQuery(() => db.questions.count(), []) ?? 0
  const recentQs  = useLiveQuery(() => db.questions.orderBy('updatedAt').reverse().limit(5).toArray(), []) ?? []

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
    const url = `${window.location.origin}${window.location.pathname}?window=editor${projectId ? `&project=${projectId}` : ''}`
    window.open(url, '_blank', 'width=1100,height=800')
  }

  const openViewer = (projectId?: string) => {
    const url = `${window.location.origin}${window.location.pathname}?window=viewer${projectId ? `&project=${projectId}` : ''}`
    window.open(url, '_blank', 'width=1200,height=850')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteProject(deleteTarget.id)
    broadcast({ type: 'project:deleted', payload: { id: deleteTarget.id } })
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Top nav */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <BookOpen size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-[var(--text-primary)] leading-none">MockBank</h1>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Question Bank</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">

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
            <h2 className="font-display font-semibold text-base text-[var(--text-primary)]">Projects</h2>
            <Button size="sm" variant="outline" icon={<Plus size={12}/>}
              onClick={() => { setEditTarget(null); setProjectFormOpen(true) }}>
              New Project
            </Button>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              icon={<Layers size={32}/>}
              title="No projects yet"
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

        {/* Recent Questions */}
        {recentQs.length > 0 && (
          <section>
            <h2 className="font-display font-semibold text-base text-[var(--text-primary)] mb-4">Recent Activity</h2>
            <div className="space-y-2">
              {recentQs.map(q => {
                const preview = q.questionContent.segments.find(s => s.type === 'markdown' && (s as any).text)
                return (
                  <div key={q.id} className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      q.status === 'wrong' ? 'bg-rose-400' :
                      q.status === 'correct' ? 'bg-emerald-400' :
                      q.status === 'partial' ? 'bg-amber-400' : 'bg-[var(--text-muted)]'
                    }`} />
                    <p className="flex-1 text-xs text-[var(--text-secondary)] truncate font-mono">
                      {preview ? (preview as any).text.slice(0, 100) : '[Image only]'}
                    </p>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(q.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Image Store — orphan cleanup */}
        {imgStatus === 'ready' && (
          <section>
            <h2 className="font-display font-semibold text-base text-[var(--text-primary)] mb-4">Image Store</h2>
            <div className="flex items-center gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
              <HardDrive size={18} className="text-emerald-400 flex-shrink-0"/>
              <div className="flex-1">
                <p className="text-sm text-[var(--text-primary)]">Image folder is configured</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Orphaned images are files in your folder that no longer belong to any question.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {orphans !== null && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {orphans.length} orphan{orphans.length !== 1 ? 's' : ''} found
                  </span>
                )}
                {orphans && orphans.length > 0 && (
                  <Button size="sm" variant="danger" icon={<Trash size={12}/>}
                    loading={cleaningUp} onClick={deleteOrphans}>
                    Delete {orphans.length}
                  </Button>
                )}
                <Button size="sm" variant="outline" loading={cleaningUp} onClick={scanOrphans}>
                  Scan
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>

      <ProjectForm
        open={projectFormOpen}
        project={editTarget}
        onClose={() => { setProjectFormOpen(false); setEditTarget(null) }}
      />

      <ExportImportModal open={exportOpen} onClose={() => setExportOpen(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Project"
        message={`Delete project "${deleteTarget?.name}"? All its questions will be unlinked (not deleted).`}
        confirmLabel="Delete Project"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color, isText }: {
  label: string; value: string | number; color: string; isText?: boolean
}) {
  return (
    <div className="px-5 py-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
      <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
      <p className={`font-display font-bold ${isText ? 'text-base' : 'text-2xl'}`} style={{ color }}>
        {value}
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
  const qCount = useLiveQuery(
    () => db.questions.where('projectId').equals(project.id).count(),
    [project.id]
  ) ?? 0

  return (
    <div
      className="relative p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] group overflow-hidden"
      style={{ borderTopColor: project.color, borderTopWidth: 2 }}
    >
      <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at top right, ${project.color}, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] leading-tight line-clamp-2">{project.name}</h3>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={onEdit} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]">
              <Edit2 size={12}/>
            </button>
            <button onClick={onDelete} className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10">
              <Trash2 size={12}/>
            </button>
          </div>
        </div>

        {project.description && (
          <p className="text-xs text-[var(--text-muted)] mb-3 line-clamp-2">{project.description}</p>
        )}

        <p className="text-xs text-[var(--text-muted)] mb-3">{qCount} question{qCount !== 1 ? 's' : ''}</p>

        <div className="flex gap-2">
          <button onClick={onOpenEditor}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)] hover:text-[var(--text-primary)] transition-colors">
            <Plus size={10}/> Editor
          </button>
          <button onClick={onOpenViewer}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)] hover:text-[var(--text-primary)] transition-colors">
            <BookOpen size={10}/> Viewer
          </button>
        </div>
      </div>
    </div>
  )
}

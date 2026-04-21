import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { db } from '../../db/schema'
import { updateTag, deleteTag, countTagUsage, TAG_PALETTE } from '../../db/tags'
import type { Tag } from '../../types'
import { Modal, Button, ConfirmDialog } from '../UI'
import { broadcast } from '../../hooks/useBroadcast'

interface Props {
  open: boolean
  onClose: () => void
}

export function TagManager({ open, onClose }: Props) {
  const tags = useLiveQuery(() => db.tags.orderBy('name').toArray(), []) ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [editColor, setEditColor] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)
  const [deleteCount, setDeleteCount]   = useState(0)

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color)
  }

  const saveEdit = async (tag: Tag) => {
    await updateTag({ ...tag, name: editName.trim() || tag.name, color: editColor })
    broadcast({ type: 'tags:changed', payload: {} })
    setEditingId(null)
  }

  const confirmDelete = async (tag: Tag) => {
    const count = await countTagUsage(tag.id)
    setDeleteCount(count)
    setDeleteTarget(tag)
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    await deleteTag(deleteTarget.id)
    broadcast({ type: 'tags:changed', payload: {} })
    setDeleteTarget(null)
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Tag Manager" width="max-w-lg">
        {tags.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] italic text-center py-6">No tags yet</p>
        )}
        <div className="space-y-1">
          {tags.map(tag => (
            <div key={tag.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-overlay)] group">
              {editingId === tag.id ? (
                <>
                  <div className="flex gap-1 flex-wrap">
                    {TAG_PALETTE.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${editColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <input
                    className="flex-1 px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--accent)] rounded text-sm text-[var(--text-primary)] focus:outline-none"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(tag)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                  />
                  <button onClick={() => saveEdit(tag)} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={14}/></button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14}/></button>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                  <span className="flex-1 text-sm text-[var(--text-primary)]">{tag.name}</span>
                  {tag.isProjectTag && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">project</span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(tag)} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => confirmDelete(tag)} className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Tag"
        message={`Delete tag "${deleteTarget?.name}"? It's used on ${deleteCount} question${deleteCount !== 1 ? 's' : ''}. This cannot be undone.`}
        confirmLabel="Delete Tag"
        danger
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

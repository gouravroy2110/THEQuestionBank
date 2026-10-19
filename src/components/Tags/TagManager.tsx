import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2, Pencil, Check, X, Plus, Search, Tag as TagIcon, CornerDownRight, FolderTree } from 'lucide-react'
import { db } from '../../db/schema'
import { createTag, updateTag, deleteTag, countTagUsage, TAG_PALETTE } from '../../db/tags'
import { getActiveWorkspaceId } from '../../db/workspaces'
import type { Tag } from '../../types'
import { Modal, Button, ConfirmDialog } from '../UI'
import { broadcast } from '../../hooks/useBroadcast'

interface Props {
  open: boolean
  onClose: () => void
  workspaceId?: string
}

export function TagManager({ open, onClose, workspaceId }: Props) {
  const [activeWsId, setActiveWsId] = useState<string>(workspaceId ?? 'default-workspace')

  // Keep activeWsId up to date if not provided as prop
  useMemo(() => {
    if (workspaceId) {
      setActiveWsId(workspaceId)
    } else {
      getActiveWorkspaceId().then(setActiveWsId)
    }
  }, [workspaceId, open])

  const allTags = useLiveQuery(
    () => db.tags.where('workspaceId').equals(activeWsId).toArray(),
    [activeWsId]
  ) ?? []

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editParentId, setEditParentId] = useState<string | null>(null)

  // New tag state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(TAG_PALETTE[0])
  const [newParentId, setNewParentId] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)
  const [deleteCount, setDeleteCount] = useState(0)
  const [childCount, setChildCount] = useState(0)

  // Map of tags by ID for fast parent lookup
  const tagMap = useMemo(() => new Map<string, Tag>(allTags.map(t => [t.id, t])), [allTags])

  // Filtered list
  const filteredTags = useMemo(() => {
    let list = [...allTags]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(t => t.name.toLowerCase().includes(q))
    }
    // Sort root tags first, then sub-tags alphabetically
    list.sort((a, b) => {
      if (!a.parentId && b.parentId) return -1
      if (a.parentId && !b.parentId) return 1
      return a.name.localeCompare(b.name)
    })
    return list
  }, [allTags, search])

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
    setEditParentId(tag.parentId ?? null)
  }

  const saveEdit = async (tag: Tag) => {
    if (!editName.trim()) return
    await updateTag({
      ...tag,
      name: editName.trim(),
      color: editColor,
      parentId: editParentId === tag.id ? null : editParentId,
    })
    broadcast({ type: 'tags:changed', payload: {} })
    setEditingId(null)
  }

  const handleCreateTag = async () => {
    if (!newName.trim()) return
    await createTag(newName.trim(), null, activeWsId, newParentId, newColor)
    broadcast({ type: 'tags:changed', payload: {} })
    setNewName('')
    setNewParentId(null)
    setShowAddForm(false)
  }

  const confirmDelete = async (tag: Tag) => {
    const qCount = await countTagUsage(tag.id)
    const cCount = allTags.filter(t => t.parentId === tag.id).length
    setDeleteCount(qCount)
    setChildCount(cCount)
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
      <Modal open={open} onClose={onClose} title="Tag Editor" width="max-w-2xl">
        <div className="space-y-4">
          {/* Header Controls */}
          <div className="flex items-center gap-2 justify-between">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="Search tags..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <Button
              size="sm"
              variant={showAddForm ? 'outline' : 'primary'}
              icon={showAddForm ? <X size={13} /> : <Plus size={13} />}
              onClick={() => setShowAddForm(s => !s)}
            >
              {showAddForm ? 'Cancel' : 'New Tag'}
            </Button>
          </div>

          {/* New Tag Creation Card */}
          {showAddForm && (
            <div className="p-3.5 rounded-xl border border-[var(--border-bright)] bg-[var(--bg-elevated)] space-y-3 animate-scale-in">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <TagIcon size={14} className="text-[var(--accent)]" />
                <span>Create New Tag</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">Tag Name</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="e.g. DIGITAL_LOGIC or Async Circuits"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Parent Tag (Optional for hierarchy)
                  </label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    value={newParentId ?? ''}
                    onChange={e => setNewParentId(e.target.value ? e.target.value : null)}
                  >
                    <option value="">None (Top-level Category)</option>
                    {allTags.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color Palette */}
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1.5">Color</label>
                <div className="flex gap-1.5 flex-wrap">
                  {TAG_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                        newColor === c ? 'border-white scale-110 shadow-sm' : 'border-transparent'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" icon={<Check size={13} />} onClick={handleCreateTag}>
                  Create Tag
                </Button>
              </div>
            </div>
          )}

          {/* Tags List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--border)]/40 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)]">
            {filteredTags.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)] italic">
                {search ? 'No tags matching query' : 'No tags created yet. Click "New Tag" to add one.'}
              </div>
            ) : (
              filteredTags.map(tag => {
                const parentTag = tag.parentId ? tagMap.get(tag.parentId) : null
                const isEditing = editingId === tag.id

                return (
                  <div
                    key={tag.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-2 hover:bg-[var(--bg-overlay)] group transition-colors"
                  >
                    {isEditing ? (
                      <div className="w-full space-y-2.5">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            className="flex-1 px-2.5 py-1.5 bg-[var(--bg-elevated)] border border-[var(--accent)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(tag)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            autoFocus
                          />
                          <select
                            className="px-2.5 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none"
                            value={editParentId ?? ''}
                            onChange={e => setEditParentId(e.target.value ? e.target.value : null)}
                          >
                            <option value="">None (Top-level Category)</option>
                            {allTags
                              .filter(t => t.id !== tag.id && t.parentId !== tag.id)
                              .map(t => (
                                <option key={t.id} value={t.id}>
                                  Parent: {t.name}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Edit Color Palette */}
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1.5 flex-wrap">
                            {TAG_PALETTE.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditColor(c)}
                                className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${
                                  editColor === c ? 'border-white scale-110 shadow-sm' : 'border-transparent'
                                }`}
                                style={{ background: c }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveEdit(tag)}
                              className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          {parentTag && (
                            <CornerDownRight size={13} className="text-[var(--text-muted)] flex-shrink-0 ml-1" />
                          )}
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                            style={{ background: tag.color }}
                          />
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {tag.name}
                          </span>
                          {parentTag && (
                            <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded flex items-center gap-1">
                              <FolderTree size={10} /> {parentTag.name}
                            </span>
                          )}
                          {tag.isProjectTag && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                              project
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(tag)}
                            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                            title="Edit Tag"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => confirmDelete(tag)}
                            className="p-1.5 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10"
                            title="Delete Tag"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Tag"
        message={`Delete tag "${deleteTarget?.name}"? It is assigned to ${deleteCount} question${
          deleteCount !== 1 ? 's' : ''
        }.${childCount > 0 ? ` It also has ${childCount} sub-tags which will be unparented.` : ''} This cannot be undone.`}
        confirmLabel="Delete Tag"
        danger
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

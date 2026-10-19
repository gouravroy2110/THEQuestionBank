import React, { useState, useMemo } from 'react'
import {
  GripVertical, ChevronRight, ChevronDown, Plus, Edit2, Trash2,
  Check, X, FolderTree, Tag as TagIcon, ArrowDownToLine, CornerDownRight,
  Layers, ArrowUpRight
} from 'lucide-react'
import type { Tag, UUID } from '../../types'
import { updateTag, deleteTag, createTag, TAG_PALETTE, countTagUsage } from '../../db/tags'
import { broadcast } from '../../hooks/useBroadcast'
import { ConfirmDialog, Modal, Button } from '../UI'

interface Props {
  tags: Tag[]
  workspaceId: string
  searchQuery: string
  questionCounts: Record<string, number>
  columns?: 2 | 3
}

interface TreeNode {
  tag: Tag
  children: TreeNode[]
}

function isDescendant(targetId: string, potentialAncestorId: string, tagMap: Map<string, Tag>): boolean {
  if (targetId === potentialAncestorId) return true
  let curr: Tag | undefined = tagMap.get(targetId)
  while (curr && curr.parentId) {
    if (curr.parentId === potentialAncestorId) return true
    curr = tagMap.get(curr.parentId)
  }
  return false
}

export function TagHierarchyTree({
  tags,
  workspaceId,
  searchQuery,
  questionCounts,
  columns = 3,
}: Props) {
  const [draggedTagId, setDraggedTagId] = useState<string | null>(null)
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null)
  const [dragOverRoot, setDragOverRoot] = useState(false)

  // Edit Tag Modal state (for full editing of Name, Color, and Parent/Root)
  const [editModalTag, setEditModalTag] = useState<Tag | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editParentId, setEditParentId] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Inline "Add sub-tag" state
  const [addingSubtagUnderId, setAddingSubtagUnderId] = useState<string | null>(null)
  const [subtagName, setSubtagName] = useState('')
  const [subtagColor, setSubtagColor] = useState(TAG_PALETTE[0])

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  const tagMap = useMemo(() => new Map<string, Tag>(tags.map(t => [t.id, t])), [tags])

  // Build tree
  const tree = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>()
    tags.forEach(t => nodeMap.set(t.id, { tag: t, children: [] }))

    const roots: TreeNode[] = []
    tags.forEach(t => {
      const node = nodeMap.get(t.id)!
      if (t.parentId && nodeMap.has(t.parentId)) {
        nodeMap.get(t.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    })

    const sortNodes = (list: TreeNode[]) => {
      list.sort((a, b) => a.tag.name.localeCompare(b.tag.name))
      list.forEach(item => sortNodes(item.children))
    }
    sortNodes(roots)
    return roots
  }, [tags])

  // Filter tree with search query
  const searchFilter = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.trim().toLowerCase()
    const matchingIds = new Set<string>()

    const checkMatch = (node: TreeNode): boolean => {
      const selfMatch = node.tag.name.toLowerCase().includes(q)
      let childMatch = false
      for (const child of node.children) {
        if (checkMatch(child)) childMatch = true
      }
      if (selfMatch || childMatch) {
        matchingIds.add(node.tag.id)
        return true
      }
      return false
    }

    tree.forEach(checkMatch)
    return matchingIds
  }, [tree, searchQuery])

  // Open Edit Modal for a tag
  const openEditModal = (tag: Tag) => {
    setEditModalTag(tag)
    setEditName(tag.name)
    setEditColor(tag.color || TAG_PALETTE[0])
    setEditParentId(tag.parentId ?? '')
  }

  // Save Edit from Modal
  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editModalTag || !editName.trim()) return

    setSavingEdit(true)
    const newParent = editParentId.trim() ? editParentId.trim() : null

    await updateTag({
      ...editModalTag,
      name: editName.trim(),
      color: editColor,
      parentId: newParent === editModalTag.id ? null : newParent,
    })

    broadcast({ type: 'tags:changed', payload: {} })
    setSavingEdit(false)
    setEditModalTag(null)
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, tag: Tag) => {
    e.dataTransfer.setData('text/plain', tag.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedTagId(tag.id)
  }

  const handleDragEnd = () => {
    setDraggedTagId(null)
    setDragOverTargetId(null)
    setDragOverRoot(false)
  }

  const handleDragOverNode = (e: React.DragEvent, targetTag: Tag) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedTagId) return
    if (draggedTagId === targetTag.id) return

    // Prevent cycle
    if (isDescendant(targetTag.id, draggedTagId, tagMap)) {
      e.dataTransfer.dropEffect = 'none'
      return
    }

    e.dataTransfer.dropEffect = 'move'
    setDragOverTargetId(targetTag.id)
    setDragOverRoot(false)
  }

  const handleDropOnNode = async (e: React.DragEvent, targetTag: Tag) => {
    e.preventDefault()
    e.stopPropagation()

    const draggedId = draggedTagId || e.dataTransfer.getData('text/plain')
    if (!draggedId || draggedId === targetTag.id) return

    if (isDescendant(targetTag.id, draggedId, tagMap)) return

    const dragged = tagMap.get(draggedId)
    if (!dragged) return

    await updateTag({
      ...dragged,
      parentId: targetTag.id,
    })
    broadcast({ type: 'tags:changed', payload: {} })

    setDraggedTagId(null)
    setDragOverTargetId(null)
  }

  const handleDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault()
    const draggedId = draggedTagId || e.dataTransfer.getData('text/plain')
    if (!draggedId) return

    const dragged = tagMap.get(draggedId)
    if (!dragged) return

    if (dragged.parentId) {
      await updateTag({
        ...dragged,
        parentId: null,
      })
      broadcast({ type: 'tags:changed', payload: {} })
    }

    setDraggedTagId(null)
    setDragOverRoot(false)
  }

  // Create Subtag under node
  const handleCreateSubtag = async (parentId: string) => {
    if (!subtagName.trim()) return
    await createTag(subtagName.trim(), null, workspaceId, parentId, subtagColor)
    broadcast({ type: 'tags:changed', payload: {} })
    setSubtagName('')
    setAddingSubtagUnderId(null)
  }

  // Delete tag confirm
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    await deleteTag(deleteTarget.id)
    broadcast({ type: 'tags:changed', payload: {} })
    setDeleteTarget(null)
  }

  // Eligible parents for edit modal (excludes self and all descendants)
  const eligibleParents = useMemo(() => {
    if (!editModalTag) return []
    return tags.filter(t => t.id !== editModalTag.id && !isDescendant(t.id, editModalTag.id, tagMap))
  }, [editModalTag, tags, tagMap])

  // Recursive render for nested children inside a category card
  const renderSubtag = (node: TreeNode, depth: number = 0) => {
    if (searchFilter && !searchFilter.has(node.tag.id)) return null

    const isDragged = draggedTagId === node.tag.id
    const isDragOver = dragOverTargetId === node.tag.id
    const qCount = questionCounts[node.tag.id] ?? 0
    const hasChildren = node.children.length > 0
    const isAddingSub = addingSubtagUnderId === node.tag.id

    return (
      <div key={node.tag.id} className="flex flex-col">
        <div
          draggable
          onDragStart={e => handleDragStart(e, node.tag)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOverNode(e, node.tag)}
          onDragLeave={() => {
            if (dragOverTargetId === node.tag.id) setDragOverTargetId(null)
          }}
          onDrop={e => handleDropOnNode(e, node.tag)}
          style={{ marginLeft: `${depth * 14}px` }}
          className={`group flex items-center justify-between py-1.5 px-2.5 rounded-lg border transition-all text-xs ${
            isDragged
              ? 'opacity-40 bg-[var(--bg-elevated)] border-dashed border-[var(--border-bright)]'
              : isDragOver
              ? 'border-[var(--accent)] bg-[var(--accent-dim)] ring-1 ring-[var(--accent)] shadow-sm'
              : 'border-[var(--border)]/70 bg-[var(--bg-surface)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-bright)]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing p-0.5 rounded flex-shrink-0"
              title="Drag to reorder, nest into another tag, or drop onto root bar"
            >
              <GripVertical size={12} />
            </span>

            <span
              className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm"
              style={{ background: node.tag.color || '#0078d4' }}
            />

            <span className="font-medium text-[var(--text-primary)] truncate text-[11px]">
              {node.tag.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-mono text-[var(--text-muted)] px-1.5 py-0.2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]/60">
              {qCount}
            </span>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                type="button"
                onClick={() => {
                  setAddingSubtagUnderId(node.tag.id)
                  setSubtagName('')
                  setSubtagColor(TAG_PALETTE[0])
                }}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                title="Add sub-tag"
              >
                <Plus size={11} />
              </button>
              <button
                type="button"
                onClick={() => openEditModal(node.tag)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                title="Edit tag (rename, color, parent)"
              >
                <Edit2 size={11} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(node.tag)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10"
                title="Delete tag"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Inline Add subtag under this child */}
        {isAddingSub && (
          <div
            style={{ marginLeft: `${(depth + 1) * 14}px` }}
            className="my-1.5 p-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--bg-elevated)] space-y-1.5 animate-fade-in"
          >
            <div className="flex items-center gap-1.5">
              <CornerDownRight size={11} className="text-[var(--accent)] flex-shrink-0" />
              <input
                type="text"
                placeholder={`Subtag under "${node.tag.name}"…`}
                value={subtagName}
                onChange={e => setSubtagName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateSubtag(node.tag.id)
                  if (e.key === 'Escape') setAddingSubtagUnderId(null)
                }}
                autoFocus
                className="flex-1 px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => handleCreateSubtag(node.tag.id)}
                disabled={!subtagName.trim()}
                className="px-2 py-0.5 rounded bg-[var(--accent)] text-white text-[11px] font-medium disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAddingSubtagUnderId(null)}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Recursive Children */}
        {hasChildren && (
          <div className="flex flex-col gap-1 mt-1 pl-2 border-l border-[var(--border)]/40 ml-2">
            {node.children.map(child => renderSubtag(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // Render Root Category as an organized Card
  const renderRootCard = (root: TreeNode) => {
    if (searchFilter && !searchFilter.has(root.tag.id)) return null

    const isDragged = draggedTagId === root.tag.id
    const isDragOver = dragOverTargetId === root.tag.id
    const qCount = questionCounts[root.tag.id] ?? 0
    const isAddingSub = addingSubtagUnderId === root.tag.id
    const tagColor = root.tag.color || '#0078d4'

    return (
      <div
        key={root.tag.id}
        draggable
        onDragStart={e => handleDragStart(e, root.tag)}
        onDragEnd={handleDragEnd}
        onDragOver={e => handleDragOverNode(e, root.tag)}
        onDragLeave={() => {
          if (dragOverTargetId === root.tag.id) setDragOverTargetId(null)
        }}
        onDrop={e => handleDropOnNode(e, root.tag)}
        className={`group relative flex flex-col rounded-xl border bg-[var(--bg-elevated)] transition-all overflow-hidden ${
          isDragged
            ? 'opacity-40 border-dashed border-[var(--border-bright)]'
            : isDragOver
            ? 'border-[var(--accent)] bg-[var(--accent-dim)] ring-2 ring-[var(--accent)]/50 shadow-lg'
            : 'border-[var(--border)] hover:border-[var(--border-bright)] hover:shadow-md'
        }`}
        style={{ borderTop: `3px solid ${tagColor}` }}
      >
        {/* Category Header */}
        <div className="p-3 bg-[var(--bg-surface)]/70 border-b border-[var(--border)]/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing p-0.5 rounded flex-shrink-0"
              title="Drag category"
            >
              <GripVertical size={13} />
            </span>

            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
              style={{ background: tagColor }}
            />

            <h3 className="font-display font-semibold text-xs text-[var(--text-primary)] truncate">
              {root.tag.name}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {root.children.length > 0 && (
              <span className="text-[10px] font-mono text-violet-400 px-1.5 py-0.2 rounded bg-violet-500/10 border border-violet-500/20">
                {root.children.length} sub
              </span>
            )}

            <span className="text-[10px] font-mono text-[var(--text-muted)] px-1.5 py-0.2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
              {qCount} q
            </span>

            {/* Actions */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                type="button"
                onClick={() => {
                  setAddingSubtagUnderId(root.tag.id)
                  setSubtagName('')
                  setSubtagColor(TAG_PALETTE[0])
                }}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-overlay)]"
                title="Add sub-tag under this category"
              >
                <Plus size={12} />
              </button>

              <button
                type="button"
                onClick={() => openEditModal(root.tag)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"
                title="Edit tag (rename, color, change parent/root)"
              >
                <Edit2 size={12} />
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget(root.tag)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10"
                title="Delete tag"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Card Body: Sub-tags */}
        <div className="p-3 flex-1 flex flex-col gap-1.5">
          {/* Inline Add Subtag form */}
          {isAddingSub && (
            <div className="p-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--bg-surface)] space-y-1.5 animate-fade-in mb-1">
              <div className="flex items-center gap-1.5">
                <CornerDownRight size={11} className="text-[var(--accent)] flex-shrink-0" />
                <input
                  type="text"
                  placeholder={`New sub-tag under "${root.tag.name}"…`}
                  value={subtagName}
                  onChange={e => setSubtagName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateSubtag(root.tag.id)
                    if (e.key === 'Escape') setAddingSubtagUnderId(null)
                  }}
                  autoFocus
                  className="flex-1 px-2 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => handleCreateSubtag(root.tag.id)}
                  disabled={!subtagName.trim()}
                  className="px-2 py-0.5 rounded bg-[var(--accent)] text-white text-[11px] font-medium disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setAddingSubtagUnderId(null)}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="flex items-center gap-1 pl-4">
                {TAG_PALETTE.slice(0, 8).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSubtagColor(c)}
                    className={`w-3 h-3 rounded-full transition-transform ${
                      subtagColor === c ? 'ring-1 ring-white scale-110' : ''
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {root.children.length === 0 ? (
            <div
              className={`p-3 rounded-lg border border-dashed text-center text-[11px] transition-colors ${
                isDragOver
                  ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                  : 'border-[var(--border)]/50 text-[var(--text-muted)] hover:border-[var(--border)]'
              }`}
            >
              No sub-tags yet. Drag tags here to nest.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {root.children.map(child => renderSubtag(child, 0))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const visibleRoots = useMemo(() => {
    if (!searchFilter) return tree
    return tree.filter(root => searchFilter.has(root.tag.id))
  }, [tree, searchFilter])

  const columnBuckets = useMemo(() => {
    const numCols = columns
    const buckets: TreeNode[][] = Array.from({ length: numCols }, () => [])
    visibleRoots.forEach((root, idx) => {
      buckets[idx % numCols].push(root)
    })
    return buckets
  }, [visibleRoots, columns])

  return (
    <div className="flex flex-col gap-5">
      {/* ── Root Drop Zone Banner ── */}
      <div
        onDragOver={e => {
          e.preventDefault()
          setDragOverRoot(true)
          setDragOverTargetId(null)
        }}
        onDragLeave={() => setDragOverRoot(false)}
        onDrop={handleDropOnRoot}
        className={`py-2.5 px-4 rounded-xl border-2 border-dashed text-xs text-center transition-all ${
          dragOverRoot
            ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] font-medium shadow-md scale-[1.01]'
            : draggedTagId
            ? 'border-[var(--accent)]/50 bg-[var(--accent-dim)]/20 text-[var(--text-primary)] animate-pulse'
            : 'border-[var(--border)] bg-[var(--bg-elevated)]/40 text-[var(--text-muted)] hover:border-[var(--border-bright)] hover:text-[var(--text-secondary)]'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <ArrowDownToLine size={13} className={draggedTagId ? 'text-[var(--accent)]' : ''} />
          <span>
            {draggedTagId
              ? 'Drop tag here to promote to Top-Level Category'
              : 'Drag & drop tags between category cards to nest them, or drop here to make root category'}
          </span>
        </div>
      </div>

      {/* ── Multi-Column Category Cards (Masonry Puzzle Layout) ── */}
      {visibleRoots.length === 0 ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-2xl">
          {searchQuery ? 'No tags match your search' : 'No tags in this workspace. Click "+ New Tag" to create one!'}
        </div>
      ) : (
        <div
          className={`grid gap-6 items-start ${
            columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {columnBuckets.map((bucket, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-6">
              {bucket.map(root => renderRootCard(root))}
            </div>
          ))}
        </div>
      )}

      {/* ── Comprehensive Edit Tag Modal (Rename, Color & Change Parent/Root) ── */}
      {editModalTag && (
        <Modal
          open={!!editModalTag}
          onClose={() => setEditModalTag(null)}
          title={`Edit Tag "${editModalTag.name}"`}
          width="max-w-md"
        >
          <form onSubmit={handleSaveEditModal} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Tag Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                autoFocus
                required
                className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                Parent Category / Hierarchy
              </label>
              <select
                value={editParentId}
                onChange={e => setEditParentId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                <option value="">None (Top-Level Category)</option>
                {eligibleParents.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.parentId ? `↳ ${t.name}` : t.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Select "None" to make this a root category, or choose any other tag as its parent.
              </p>
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
                    onClick={() => setEditColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      editColor === c ? 'border-white scale-110 shadow-sm' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditModalTag(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={savingEdit} disabled={!editName.trim()}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Tag"
        message={`Delete tag "${deleteTarget?.name}"? Any sub-tags under it will become top-level categories, and questions will no longer have this tag.`}
        confirmLabel="Delete Tag"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

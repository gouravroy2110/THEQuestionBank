import React, { useState, useMemo } from 'react'
import {
  GripVertical, ChevronRight, ChevronDown, Plus, Edit2, Trash2,
  Check, X, FolderTree, Tag as TagIcon, ArrowDownToLine, CornerDownRight
} from 'lucide-react'
import type { Tag, UUID } from '../../types'
import { updateTag, deleteTag, createTag, TAG_PALETTE, countTagUsage } from '../../db/tags'
import { broadcast } from '../../hooks/useBroadcast'
import { ConfirmDialog } from '../UI'

interface Props {
  tags: Tag[]
  workspaceId: string
  searchQuery: string
  questionCounts: Record<string, number>
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

export function TagHierarchyTree({ tags, workspaceId, searchQuery, questionCounts }: Props) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [draggedTagId, setDraggedTagId] = useState<string | null>(null)
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null)
  const [dragOverRoot, setDragOverRoot] = useState(false)

  // In-place editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

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

  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

    if (isDescendant(targetTag.id, draggedId, tagMap)) {
      return
    }

    const dragged = tagMap.get(draggedId)
    if (!dragged) return

    await updateTag({
      ...dragged,
      parentId: targetTag.id,
    })
    broadcast({ type: 'tags:changed', payload: {} })

    // Ensure target node is expanded to see newly nested child
    setCollapsedIds(prev => {
      const next = new Set(prev)
      next.delete(targetTag.id)
      return next
    })

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

  // Inline Edit Save
  const saveInlineEdit = async (tag: Tag) => {
    if (!editName.trim()) return
    await updateTag({
      ...tag,
      name: editName.trim(),
      color: editColor,
    })
    broadcast({ type: 'tags:changed', payload: {} })
    setEditingId(null)
  }

  // Create Subtag under node
  const handleCreateSubtag = async (parentId: string) => {
    if (!subtagName.trim()) return
    await createTag(subtagName.trim(), null, workspaceId, parentId, subtagColor)
    broadcast({ type: 'tags:changed', payload: {} })
    setSubtagName('')
    setAddingSubtagUnderId(null)
    // Expand parent
    setCollapsedIds(prev => {
      const next = new Set(prev)
      next.delete(parentId)
      return next
    })
  }

  // Delete tag
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    await deleteTag(deleteTarget.id)
    broadcast({ type: 'tags:changed', payload: {} })
    setDeleteTarget(null)
  }

  const renderNode = (node: TreeNode, depth: number = 0) => {
    if (searchFilter && !searchFilter.has(node.tag.id)) return null

    const hasChildren = node.children.length > 0
    const isCollapsed = !searchFilter && collapsedIds.has(node.tag.id)
    const isDragged = draggedTagId === node.tag.id
    const isDragOver = dragOverTargetId === node.tag.id
    const isEditing = editingId === node.tag.id
    const isAddingSub = addingSubtagUnderId === node.tag.id
    const qCount = questionCounts[node.tag.id] ?? 0

    return (
      <div key={node.tag.id} className="relative flex flex-col">
        {/* Node Row */}
        <div
          draggable={!isEditing}
          onDragStart={e => handleDragStart(e, node.tag)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOverNode(e, node.tag)}
          onDragLeave={() => {
            if (dragOverTargetId === node.tag.id) setDragOverTargetId(null)
          }}
          onDrop={e => handleDropOnNode(e, node.tag)}
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
          className={`group flex items-center justify-between py-2 px-3 rounded-xl border transition-all text-xs ${
            isDragged
              ? 'opacity-40 bg-[var(--bg-elevated)] border-dashed border-[var(--border-bright)]'
              : isDragOver
              ? 'border-[var(--accent)] bg-[var(--accent-dim)] shadow-md ring-2 ring-[var(--accent)]/50'
              : 'border-[var(--border)]/60 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-bright)]'
          }`}
        >
          {/* Left part: drag handle, expand toggle, color, name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing p-0.5 rounded"
              title="Drag to re-parent under another tag or to root"
            >
              <GripVertical size={13} />
            </span>

            {/* Expand / Collapse Chevron */}
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapse(node.tag.id)}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
              >
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>
            ) : (
              <span className="w-4 h-4 flex items-center justify-center text-[var(--text-muted)]/30">
                •
              </span>
            )}

            {/* Tag Color Dot */}
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
              style={{ background: node.tag.color }}
            />

            {/* Tag Name / Inline Edit */}
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveInlineEdit(node.tag)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  autoFocus
                  className="px-2 py-0.5 bg-[var(--bg-elevated)] border border-[var(--accent)] rounded text-xs text-[var(--text-primary)] focus:outline-none"
                />
                <div className="flex gap-1 flex-wrap">
                  {TAG_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-3.5 h-3.5 rounded-full transition-transform ${
                        editColor === c ? 'ring-2 ring-white scale-110' : ''
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => saveInlineEdit(node.tag)}
                  className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-overlay)]"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <span className="font-medium text-[var(--text-primary)] truncate">
                {node.tag.name}
              </span>
            )}
          </div>

          {/* Right part: Question count badge, children count, actions */}
          {!isEditing && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasChildren && (
                <span className="text-[10px] font-mono text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
                  {node.children.length} subtag{node.children.length !== 1 ? 's' : ''}
                </span>
              )}

              <span className="text-[10px] font-mono text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
                {qCount} question{qCount !== 1 ? 's' : ''}
              </span>

              {/* Action buttons on hover */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                {/* Add Subtag */}
                <button
                  type="button"
                  onClick={() => {
                    setAddingSubtagUnderId(node.tag.id)
                    setSubtagName('')
                    setSubtagColor(TAG_PALETTE[0])
                  }}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-overlay)]"
                  title="Add sub-tag under this"
                >
                  <Plus size={12} />
                </button>

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(node.tag.id)
                    setEditName(node.tag.name)
                    setEditColor(node.tag.color)
                  }}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"
                  title="Edit Tag"
                >
                  <Edit2 size={12} />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(node.tag)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10"
                  title="Delete Tag"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drop target visual label when dragging over */}
        {isDragOver && (
          <div
            style={{ marginLeft: `${depth * 24 + 28}px` }}
            className="my-1 px-3 py-1 text-[11px] font-medium text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--accent)]/40 rounded-lg flex items-center gap-1.5 animate-pulse"
          >
            <CornerDownRight size={12} />
            <span>Drop to nest under "{node.tag.name}"</span>
          </div>
        )}

        {/* Inline Add Subtag Form */}
        {isAddingSub && (
          <div
            style={{ marginLeft: `${(depth + 1) * 24 + 8}px` }}
            className="my-1.5 p-2.5 rounded-xl border border-[var(--border-bright)] bg-[var(--bg-elevated)] space-y-2 animate-fade-in"
          >
            <div className="flex items-center gap-2">
              <CornerDownRight size={12} className="text-violet-400 flex-shrink-0" />
              <input
                type="text"
                placeholder={`New subtag under "${node.tag.name}"…`}
                value={subtagName}
                onChange={e => setSubtagName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateSubtag(node.tag.id)
                  if (e.key === 'Escape') setAddingSubtagUnderId(null)
                }}
                autoFocus
                className="flex-1 px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => handleCreateSubtag(node.tag.id)}
                disabled={!subtagName.trim()}
                className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAddingSubtagUnderId(null)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={13} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 pl-5">
              <span className="text-[10px] text-[var(--text-muted)]">Color:</span>
              {TAG_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSubtagColor(c)}
                  className={`w-3.5 h-3.5 rounded-full transition-transform ${
                    subtagColor === c ? 'ring-2 ring-white scale-110' : ''
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Children Sublist */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col gap-1 mt-1">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Root Drop Zone */}
      <div
        onDragOver={e => {
          e.preventDefault()
          setDragOverRoot(true)
          setDragOverTargetId(null)
        }}
        onDragLeave={() => setDragOverRoot(false)}
        onDrop={handleDropOnRoot}
        className={`py-2 px-4 rounded-xl border-2 border-dashed text-xs text-center transition-all ${
          dragOverRoot
            ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] font-medium shadow-md'
            : draggedTagId
            ? 'border-[var(--border-bright)] bg-[var(--bg-elevated)]/50 text-[var(--text-muted)] animate-pulse'
            : 'border-transparent text-transparent hover:border-[var(--border)] hover:text-[var(--text-muted)]'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <ArrowDownToLine size={13} />
          <span>Drop here to move tag to Root / Top-Level Category</span>
        </div>
      </div>

      {/* Tree Content */}
      {tree.length === 0 ? (
        <div className="p-8 text-center text-xs text-[var(--text-muted)]">
          No tags found in this workspace. Create one above!
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tree.map(root => renderNode(root, 0))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Tag"
        message={`Delete tag "${deleteTarget?.name}"? Any sub-tags under it will become top-level tags, and questions will simply lose this tag.`}
        confirmLabel="Delete Tag"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

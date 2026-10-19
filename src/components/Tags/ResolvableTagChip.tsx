import React, { useState, useRef, useMemo } from 'react'
import { GitBranch, CornerLeftUp, Check, Plus, ChevronRight, X } from 'lucide-react'
import type { Tag, UUID } from '../../types'

export interface ResolvableTagChipProps {
  tag: Tag
  tagMap: Map<string, Tag>
  selectedIds: UUID[]
  onRemove?: () => void
  onAddParents?: (parentIds: UUID[]) => void
  dimmed?: boolean
  size?: 'sm' | 'md'
  title?: string
}

export function ResolvableTagChip({
  tag,
  tagMap,
  selectedIds,
  onRemove,
  onAddParents,
  dimmed,
  size = 'md',
  title,
}: ResolvableTagChipProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const leaveTimerRef = useRef<number | null>(null)

  // Compute all ancestors from immediate parent up to root
  const ancestors = useMemo(() => {
    const list: Tag[] = []
    const visited = new Set<string>([tag.id])
    let curr = tag.parentId ? tagMap.get(tag.parentId) : null
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id)
      list.push(curr)
      curr = curr.parentId ? tagMap.get(curr.parentId) : null
    }
    return list // [immediateParent, ..., root]
  }, [tag, tagMap])

  // Hierarchy path from root down to this tag
  const hierarchyPath = useMemo(() => {
    return [...ancestors.slice().reverse(), tag]
  }, [ancestors, tag])

  // Ancestors that are not yet attached to the question
  const missingAncestors = useMemo(() => {
    return ancestors.filter(a => !selectedIds.includes(a.id))
  }, [ancestors, selectedIds])

  const hasAncestors = ancestors.length > 0

  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    if (hasAncestors) {
      setPopoverOpen(true)
    }
  }

  const handleMouseLeave = () => {
    leaveTimerRef.current = window.setTimeout(() => {
      setPopoverOpen(false)
    }, 200)
  }

  const bg = `${tag.color}22`
  const border = `${tag.color}55`
  const text = tag.color

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        title={hasAncestors ? undefined : (title || 'Top-level category')}
        className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-all ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        } ${dimmed ? 'opacity-50' : ''}`}
        style={{ background: bg, borderColor: border, color: text }}
      >
        {/* Subtle hierarchy icon */}
        {hasAncestors && (
          <span
            className="flex items-center cursor-help"
            title={`${ancestors.length} parent categor${ancestors.length === 1 ? 'y' : 'ies'}`}
          >
            {missingAncestors.length > 0 ? (
              <GitBranch size={10} className="text-amber-400 opacity-90" />
            ) : (
              <Check size={10} className="text-emerald-400 opacity-80" />
            )}
          </span>
        )}

        <span>{tag.name}</span>

        {onRemove && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onRemove()
            }}
            className="hover:opacity-70 transition-opacity ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            title="Remove tag"
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        )}
      </span>

      {/* ── Hover Popover for Hierarchy Resolution ── */}
      {popoverOpen && hasAncestors && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 w-72 p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl animate-fade-in text-xs text-[var(--text-primary)]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Breadcrumb Path */}
          <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] mb-1.5">
            Tag Hierarchy
          </div>
          <div className="flex items-center gap-1 flex-wrap mb-2.5 p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
            {hierarchyPath.map((item, idx) => {
              const isThisTag = item.id === tag.id
              const isAttached = selectedIds.includes(item.id)
              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && (
                    <ChevronRight size={10} className="text-[var(--text-muted)] flex-shrink-0" />
                  )}
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                      isThisTag
                        ? 'font-bold'
                        : isAttached
                        ? 'font-medium'
                        : 'opacity-70 italic'
                    }`}
                    style={{
                      color: item.color,
                      background: isThisTag ? `${item.color}20` : 'transparent',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: item.color }}
                    />
                    <span className="truncate max-w-[95px]">{item.name}</span>
                  </span>
                </React.Fragment>
              )
            })}
          </div>

          {/* Action section */}
          {missingAncestors.length > 0 ? (
            <div className="border-t border-[var(--border)] pt-2 space-y-2">
              <div className="text-[11px] text-[var(--text-muted)]">
                Unresolved parent tags ({missingAncestors.length}):
              </div>

              {/* Individual parent items */}
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {missingAncestors.map(parent => (
                  <div
                    key={parent.id}
                    className="flex items-center justify-between p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: parent.color }}
                      />
                      <span className="truncate text-[11px] text-[var(--text-secondary)]">
                        {parent.name}
                      </span>
                    </span>

                    {onAddParents && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          onAddParents([parent.id])
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-glow)] transition-colors flex items-center gap-0.5 flex-shrink-0 ml-2"
                        title={`Add ${parent.name}`}
                      >
                        <Plus size={9} /> Add
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Bulk add button if > 1 missing */}
              {onAddParents && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onAddParents(missingAncestors.map(a => a.id))
                  }}
                  className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-sm"
                >
                  <CornerLeftUp size={12} />
                  Add All Parents (+{missingAncestors.length})
                </button>
              )}
            </div>
          ) : (
            <div className="border-t border-[var(--border)] pt-2 flex items-center gap-1.5 text-[11px] text-emerald-400">
              <Check size={12} /> All parent tags already added
            </div>
          )}
        </div>
      )}
    </div>
  )
}

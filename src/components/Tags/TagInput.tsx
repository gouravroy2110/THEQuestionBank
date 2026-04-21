import { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Settings2 } from 'lucide-react'
import { db } from '../../db/schema'
import { createTag, getAllTags } from '../../db/tags'
import type { Tag, UUID } from '../../types'
import { TagChip } from '../UI'

interface Props {
  selectedIds: UUID[]
  onChange: (ids: UUID[]) => void
  projectTagIds?: UUID[]   // inherited from project — shown but not removable
  onOpenManager?: () => void
}

export function TagInput({ selectedIds, onChange, projectTagIds = [], onOpenManager }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const allTags = useLiveQuery(() => db.tags.toArray(), []) ?? []
  const tagMap = new Map<string, Tag>(allTags.map(t => [t.id, t]))

  const selectedTags   = selectedIds.map(id => tagMap.get(id)).filter((t): t is Tag => !!t)
  const projectTags    = projectTagIds.map(id => tagMap.get(id)).filter((t): t is Tag => !!t)
  const projectTagIdSet = new Set(projectTagIds)

  const filtered = allTags.filter(t =>
    !selectedIds.includes(t.id) &&
    !projectTagIdSet.has(t.id) &&
    t.name.toLowerCase().includes(query.toLowerCase())
  )

  const exactMatch = allTags.some(t => t.name.toLowerCase() === query.toLowerCase())
  const canCreate  = query.trim().length > 0 && !exactMatch

  const select = (id: UUID) => {
    onChange([...selectedIds, id])
    setQuery('')
    setOpen(false)
  }

  const remove = (id: UUID) => onChange(selectedIds.filter(i => i !== id))

  const handleCreate = async () => {
    const tag = await createTag(query.trim())
    onChange([...selectedIds, tag.id])
    setQuery('')
    setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {/* Current chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {/* Project-inherited tags */}
        {projectTags.map(t => (
          <TagChip key={t.id} name={t.name} color={t.color} dimmed size="sm"
            title="Inherited from project — edit the project to change" />
        ))}
        {/* Direct tags */}
        {selectedTags.map(t => (
          <TagChip key={t.id} name={t.name} color={t.color} onRemove={() => remove(t.id)} size="sm" />
        ))}
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="w-full px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            placeholder="Add tag…"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && canCreate) { e.preventDefault(); handleCreate() }
              if (e.key === 'Escape') setOpen(false)
            }}
          />

          {/* Dropdown */}
          {open && (filtered.length > 0 || canCreate) && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden animate-fade-in">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onMouseDown={e => { e.preventDefault(); select(t.id) }}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-overlay)] transition-colors text-sm text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <span className="text-[var(--text-primary)]">{t.name}</span>
                </button>
              ))}
              {canCreate && (
                <button
                  onMouseDown={e => { e.preventDefault(); handleCreate() }}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--accent-dim)] transition-colors text-sm border-t border-[var(--border)]"
                >
                  <Plus size={13} className="text-[var(--accent)]" />
                  <span className="text-[var(--accent)]">Create tag <strong>"{query}"</strong></span>
                </button>
              )}
            </div>
          )}
        </div>

        {onOpenManager && (
          <button
            onClick={onOpenManager}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
            title="Manage all tags"
          >
            <Settings2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

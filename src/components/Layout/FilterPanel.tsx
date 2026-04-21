import { useLiveQuery } from 'dexie-react-hooks'
import { X, Search, SlidersHorizontal } from 'lucide-react'
import { db } from '../../db/schema'
import type { FilterState } from '../../types'
import { TagChip, SectionLabel, Button } from '../UI'
import { useState } from 'react'


interface Props {
  filter: FilterState
  onChange: (f: FilterState) => void
  total: number
}

const STATUSES     = ['unattempted','wrong','partial','correct'] as const
const DIFFICULTIES = ['easy','medium','hard','unseen'] as const

const statusColors: Record<string,string> = {
  wrong:'#f43f5e', partial:'#f59e0b', correct:'#10b981', unattempted:'#5a5a80',
}
const diffColors: Record<string,string> = {
  easy:'#10b981', medium:'#0ea5e9', hard:'#f43f5e', unseen:'#8b5cf6',
}

export function FilterPanel({ filter, onChange, total }: Props) {
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? []
  const allTags  = useLiveQuery(() => db.tags.toArray(), []) ?? []
  
  const [tagSearch, setTagSearch] = useState('')

  const visibleTags = tagSearch.trim()
    ? allTags.filter((t: any) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
    : allTags

  const set = (patch: Partial<FilterState>) => onChange({ ...filter, ...patch })

  const toggleStatus = (s: typeof STATUSES[number]) => {
    const list = filter.statuses.includes(s)
      ? filter.statuses.filter(x => x !== s)
      : [...filter.statuses, s]
    set({ statuses: list })
  }

  const toggleDiff = (d: typeof DIFFICULTIES[number]) => {
    const list = filter.difficulties.includes(d)
      ? filter.difficulties.filter(x => x !== d)
      : [...filter.difficulties, d]
    set({ difficulties: list })
  }

  const toggleTag = (id: string) => {
    const list = filter.tagIds.includes(id)
      ? filter.tagIds.filter(x => x !== id)
      : [...filter.tagIds, id]
    set({ tagIds: list })
  }

  const clearAll = () => onChange({
    projectId: 'all', statuses: [], difficulties: [], tagIds: [],
    tagMode: 'and', textSearch: '', metaFilters: [], sortBy: 'createdAt', sortDir: 'desc',
  })

  const activeCount = [
    filter.projectId !== 'all',
    filter.statuses.length > 0,
    filter.difficulties.length > 0,
    filter.tagIds.length > 0,
    filter.textSearch.length > 0,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col gap-5 px-4 py-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-[var(--accent)]" />
          <span className="font-display font-semibold text-sm text-[var(--text-primary)]">Filters</span>
          {activeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white font-medium">{activeCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{total} questions</span>
          {activeCount > 0 && (
            <button onClick={clearAll} className="text-[10px] text-[var(--text-muted)] hover:text-rose-400 transition-colors">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Text search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          className="w-full pl-8 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          placeholder="Search text…"
          value={filter.textSearch}
          onChange={e => set({ textSearch: e.target.value })}
        />
      </div>

      {/* Project */}
      <div>
        <SectionLabel>Project</SectionLabel>
        <div className="mt-1.5 space-y-1">
          <FilterOption
            label="All Projects"
            active={filter.projectId === 'all'}
            onClick={() => set({ projectId: 'all' })}
          />
          {projects.map(p => (
            <FilterOption
              key={p.id}
              label={p.name}
              color={p.color}
              active={filter.projectId === p.id}
              onClick={() => set({ projectId: p.id })}
            />
          ))}
        </div>
      </div>

      {/* Status */}
      <div>
        <SectionLabel>Status</SectionLabel>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
                filter.statuses.includes(s)
                  ? 'border-transparent text-white'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)]'
              }`}
              style={filter.statuses.includes(s) ? { background: statusColors[s] } : {}}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <SectionLabel>Difficulty</SectionLabel>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DIFFICULTIES.map(d => (
            <button
              key={d}
              onClick={() => toggleDiff(d)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
                filter.difficulties.includes(d)
                  ? 'border-transparent text-white'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)]'
              }`}
              style={filter.difficulties.includes(d) ? { background: diffColors[d] } : {}}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      {/* Tags */}
<div>
  <div className="flex items-center justify-between mb-1.5">
    <SectionLabel>Tags</SectionLabel>
    {filter.tagIds.length > 1 && (
      <button
        onClick={() => set({ tagMode: filter.tagMode === 'and' ? 'or' : 'and' })}
        className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-dim)]"
      >
        {filter.tagMode.toUpperCase()}
      </button>
    )}
  </div>

  {/* Tag search bar — NEW */}
  {allTags.length > 6 && (
    <div className="relative mb-2">
      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        className="w-full pl-6 pr-3 py-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
        placeholder="Search tags…"
        value={tagSearch}
        onChange={e => setTagSearch(e.target.value)}
      />
    </div>
  )}

  <div className="flex flex-wrap gap-1.5">
    {visibleTags.map((t: any) => (
      <button key={t.id} onClick={() => toggleTag(t.id)}>
        <TagChip
          name={t.name}
          color={t.color}
          size="sm"
          dimmed={!filter.tagIds.includes(t.id)}
        />
      </button>
    ))}
    {visibleTags.length === 0 && (
      <span className="text-xs text-[var(--text-muted)] italic">No tags match</span>
    )}
  </div>
</div>

      {/* Sort */}
      <div>
        <SectionLabel>Sort</SectionLabel>
        <div className="mt-1.5 flex gap-2">
          <select
            className="flex-1 px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            value={filter.sortBy}
            onChange={e => set({ sortBy: e.target.value as FilterState['sortBy'] })}
          >
            <option value="createdAt">Date Added</option>
            <option value="updatedAt">Last Updated</option>
            <option value="status">Status</option>
            <option value="difficulty">Difficulty</option>
            <option value="smart">Smart (Wrong first)</option>
          </select>
          <button
            onClick={() => set({ sortDir: filter.sortDir === 'asc' ? 'desc' : 'asc' })}
            className="px-2 py-1.5 border border-[var(--border)] rounded-lg text-xs text-[var(--text-muted)] hover:border-[var(--border-bright)] transition-colors"
          >
            {filter.sortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterOption({ label, color, active, onClick }: {
  label: string; color?: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs transition-all text-left ${
        active
          ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
      }`}
    >
      {color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />}
      <span className="truncate">{label}</span>
    </button>
  )
}

import { useMemo } from 'react'
import type { Question, FilterState, Tag, Project } from '../types'

const STATUS_ORDER: Record<string,number> = { wrong:0, partial:1, unattempted:2, correct:3 }
const DIFF_ORDER:   Record<string,number> = { unseen:0, hard:1, medium:2, easy:3 }

export function useFilter(
  questions: Question[],
  filter: FilterState,
  tagMap: Map<string, Tag>,
  projectMap: Map<string, Project>,
): Question[] {
  return useMemo(() => {
    let qs = [...questions]

    // Project
    if (filter.projectId !== 'all') {
      qs = qs.filter(q => q.projectId === filter.projectId)
    }

    // Status
    if (filter.statuses.length > 0) {
      qs = qs.filter(q => filter.statuses.includes(q.status))
    }

    // Difficulty
    if (filter.difficulties.length > 0) {
      qs = qs.filter(q => filter.difficulties.includes(q.difficulty))
    }

    // Tags
    if (filter.tagIds.length > 0) {
      qs = qs.filter(q => {
        const project = q.projectId ? projectMap.get(q.projectId) : null
        const effectiveTagIds = new Set([...q.tagIds, ...(project?.tagIds ?? [])])
        if (filter.tagMode === 'and') {
          return filter.tagIds.every(id => effectiveTagIds.has(id))
        } else {
          return filter.tagIds.some(id => effectiveTagIds.has(id))
        }
      })
    }

    // Text search (against all markdown segments)
    if (filter.textSearch.trim()) {
      const needle = filter.textSearch.toLowerCase()
      qs = qs.filter(q => {
        const allText = [
          ...q.questionContent.segments,
          ...q.solutionContent.segments,
        ]
          .filter(s => s.type === 'markdown')
          .map(s => (s as any).text ?? '')
          .join(' ')
          .toLowerCase()
        return allText.includes(needle) || q.source.toLowerCase().includes(needle)
      })
    }

    // Meta filters
    for (const mf of filter.metaFilters) {
      if (!mf.key) continue
      qs = qs.filter(q => {
        const project = q.projectId ? projectMap.get(q.projectId) : null
        const allMeta = [...(project?.metadata ?? []), ...q.metadata]
        return allMeta.some(m =>
          m.key.toLowerCase() === mf.key.toLowerCase() &&
          m.value.toLowerCase().includes(mf.value.toLowerCase())
        )
      })
    }

    // Sort
    qs.sort((a, b) => {
      let cmp = 0
      switch (filter.sortBy) {
        case 'createdAt': cmp = a.createdAt - b.createdAt; break
        case 'updatedAt': cmp = a.updatedAt - b.updatedAt; break
        case 'status':    cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]; break
        case 'difficulty':cmp = DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]; break
        case 'smart':
          cmp = (STATUS_ORDER[a.status] * 4 + DIFF_ORDER[a.difficulty]) -
                (STATUS_ORDER[b.status] * 4 + DIFF_ORDER[b.difficulty])
          break
      }
      return filter.sortDir === 'desc' ? -cmp : cmp
    })

    return qs
  }, [questions, filter, tagMap, projectMap])
}

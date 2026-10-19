import { db } from '../db/schema'
import type { Question, Project, Tag, ImageRecord, Workspace } from '../types'
import { getActiveWorkspaceId } from '../db/workspaces'

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportBundle {
  version: 1 | 2
  exportedAt: number
  workspaces?: Workspace[]
  questions: Question[]
  projects: Project[]
  tags: Tag[]
  images: ImageRecord[]   // metadata only — no file bytes
}

export async function exportAll(): Promise<ExportBundle> {
  const [workspaces, questions, projects, tags, images] = await Promise.all([
    db.workspaces.toArray(),
    db.questions.toArray(),
    db.projects.toArray(),
    db.tags.toArray(),
    db.images.toArray(),
  ])
  return { version: 2, exportedAt: Date.now(), workspaces, questions, projects, tags, images }
}

export async function exportWorkspace(workspaceId: string): Promise<ExportBundle> {
  const [workspace, questions, projects, tags] = await Promise.all([
    db.workspaces.get(workspaceId),
    db.questions.where('workspaceId').equals(workspaceId).toArray(),
    db.projects.where('workspaceId').equals(workspaceId).toArray(),
    db.tags.where('workspaceId').equals(workspaceId).toArray(),
  ])

  const imageIds = new Set(
    questions.flatMap(q =>
      [...q.questionContent.segments, ...q.solutionContent.segments]
        .filter(s => s.type === 'image')
        .map(s => (s as any).imageId)
    )
  )

  const images = await db.images.where('id').anyOf([...imageIds]).toArray()

  return {
    version: 2,
    exportedAt: Date.now(),
    workspaces: workspace ? [workspace] : [],
    questions,
    projects,
    tags,
    images,
  }
}

export async function exportFiltered(questionIds: string[]): Promise<ExportBundle> {
  const questions = await db.questions.where('id').anyOf(questionIds).toArray()

  // Collect referenced workspace/project/tag/image IDs
  const workspaceIds = new Set(questions.map(q => q.workspaceId).filter(Boolean) as string[])
  const projectIds   = new Set(questions.map(q => q.projectId).filter(Boolean) as string[])
  const tagIds       = new Set(questions.flatMap(q => q.tagIds))
  const imageIds     = new Set(
    questions.flatMap(q =>
      [...q.questionContent.segments, ...q.solutionContent.segments]
        .filter(s => s.type === 'image')
        .map(s => (s as any).imageId)
    )
  )

  // Also include project tags and project workspaceIds
  const projects = await db.projects.where('id').anyOf([...projectIds]).toArray()
  projects.forEach(p => {
    p.tagIds.forEach(id => tagIds.add(id))
    if (p.workspaceId) workspaceIds.add(p.workspaceId)
  })

  // Also recursively collect all ancestor tags so tag hierarchy is preserved
  const allTagsList = await db.tags.toArray()
  const tagLookup = new Map(allTagsList.map(t => [t.id, t]))
  for (const tid of Array.from(tagIds)) {
    let curr = tagLookup.get(tid)
    const visited = new Set<string>()
    while (curr?.parentId && !visited.has(curr.parentId)) {
      visited.add(curr.parentId)
      tagIds.add(curr.parentId)
      curr = tagLookup.get(curr.parentId)
    }
  }

  const [workspaces, tags, images] = await Promise.all([
    db.workspaces.where('id').anyOf([...workspaceIds]).toArray(),
    db.tags.where('id').anyOf([...tagIds]).toArray(),
    db.images.where('id').anyOf([...imageIds]).toArray(),
  ])

  return { version: 2, exportedAt: Date.now(), workspaces, questions, projects, tags, images }
}

export function downloadJSON(bundle: ExportBundle, filename?: string) {
  const name = filename ?? `mockbank-export-${new Date().toISOString().slice(0,10)}.json`
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Import ───────────────────────────────────────────────────────────────────

export type ImportMode = 'skip' | 'overwrite'

export interface ImportResult {
  workspaces: number
  questions: number
  projects:  number
  tags:      number
  skipped:   number
}

export async function importBundle(
  bundle: ExportBundle,
  mode: ImportMode = 'skip',
  targetWorkspaceId?: string,
): Promise<ImportResult> {
  const result: ImportResult = { workspaces: 0, questions: 0, projects: 0, tags: 0, skipped: 0 }

  const fallbackWorkspaceId = targetWorkspaceId || (await getActiveWorkspaceId()) || 'default-workspace'

  await db.transaction('rw', db.workspaces, db.questions, db.projects, db.tags, db.images, async () => {
    // 1. Workspaces
    if (bundle.workspaces && bundle.workspaces.length > 0) {
      for (const ws of bundle.workspaces) {
        const existing = await db.workspaces.get(ws.id)
        if (existing && mode === 'skip') { result.skipped++; continue }
        await db.workspaces.put(ws)
        result.workspaces++
      }
    }

    // 2. Tags
    for (const tag of bundle.tags) {
      const item: Tag = {
        ...tag,
        workspaceId: tag.workspaceId || fallbackWorkspaceId,
      }
      const existing = await db.tags.get(item.id)
      if (existing && mode === 'skip') { result.skipped++; continue }
      await db.tags.put(item)
      result.tags++
    }

    // 3. Projects
    for (const project of bundle.projects) {
      const item: Project = {
        ...project,
        workspaceId: project.workspaceId || fallbackWorkspaceId,
      }
      const existing = await db.projects.get(item.id)
      if (existing && mode === 'skip') { result.skipped++; continue }
      await db.projects.put(item)
      result.projects++
    }

    // 4. Questions
    for (const question of bundle.questions) {
      const item: Question = {
        ...question,
        workspaceId: question.workspaceId || fallbackWorkspaceId,
      }
      const existing = await db.questions.get(item.id)
      if (existing && mode === 'skip') { result.skipped++; continue }
      await db.questions.put(item)
      result.questions++
    }

    // 5. Image metadata (not the actual files)
    for (const img of bundle.images) {
      const existing = await db.images.get(img.id)
      if (!existing) await db.images.put(img)
    }
  })

  return result
}

export function readJSONFile(file: File): Promise<ExportBundle> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string) as ExportBundle
        if (data.version !== 1 && data.version !== 2) throw new Error('Unknown export format (expected version 1 or 2)')
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsText(file)
  })
}

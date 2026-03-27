import { db } from '../db/schema'
import type { Question, Project, Tag, ImageRecord } from '../types'

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportBundle {
  version: 1
  exportedAt: number
  questions: Question[]
  projects: Project[]
  tags: Tag[]
  images: ImageRecord[]   // metadata only — no file bytes
}

export async function exportAll(): Promise<ExportBundle> {
  const [questions, projects, tags, images] = await Promise.all([
    db.questions.toArray(),
    db.projects.toArray(),
    db.tags.toArray(),
    db.images.toArray(),
  ])
  return { version: 1, exportedAt: Date.now(), questions, projects, tags, images }
}

export async function exportFiltered(questionIds: string[]): Promise<ExportBundle> {
  const questions = await db.questions.where('id').anyOf(questionIds).toArray()

  // Collect referenced project/tag/image IDs
  const projectIds = new Set(questions.map(q => q.projectId).filter(Boolean) as string[])
  const tagIds     = new Set(questions.flatMap(q => q.tagIds))
  const imageIds   = new Set(
    questions.flatMap(q =>
      [...q.questionContent.segments, ...q.solutionContent.segments]
        .filter(s => s.type === 'image')
        .map(s => (s as any).imageId)
    )
  )

  // Also include project tags
  const projects = await db.projects.where('id').anyOf([...projectIds]).toArray()
  projects.forEach(p => p.tagIds.forEach(id => tagIds.add(id)))

  const [tags, images] = await Promise.all([
    db.tags.where('id').anyOf([...tagIds]).toArray(),
    db.images.where('id').anyOf([...imageIds]).toArray(),
  ])

  return { version: 1, exportedAt: Date.now(), questions, projects, tags, images }
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
  questions: number
  projects:  number
  tags:      number
  skipped:   number
}

export async function importBundle(
  bundle: ExportBundle,
  mode: ImportMode = 'skip',
): Promise<ImportResult> {
  const result: ImportResult = { questions: 0, projects: 0, tags: 0, skipped: 0 }

  await db.transaction('rw', db.questions, db.projects, db.tags, db.images, async () => {
    // Tags first
    for (const tag of bundle.tags) {
      const existing = await db.tags.get(tag.id)
      if (existing && mode === 'skip') { result.skipped++; continue }
      await db.tags.put(tag)
      result.tags++
    }

    // Projects
    for (const project of bundle.projects) {
      const existing = await db.projects.get(project.id)
      if (existing && mode === 'skip') { result.skipped++; continue }
      await db.projects.put(project)
      result.projects++
    }

    // Questions
    for (const question of bundle.questions) {
      const existing = await db.questions.get(question.id)
      if (existing && mode === 'skip') { result.skipped++; continue }
      await db.questions.put(question)
      result.questions++
    }

    // Image metadata (not the actual files)
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
        if (data.version !== 1) throw new Error('Unknown export format')
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsText(file)
  })
}

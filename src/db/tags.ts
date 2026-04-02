import { db } from './schema';
import type { Tag, UUID } from '../types';
import { v4 as uuid } from 'uuid';

export const TAG_PALETTE = [
  '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#f43f5e',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6',
  '#a855f7', '#eab308', '#22c55e', '#3b82f6', '#ef4444',
  '#6366f1',
];

export function pickColor(existingColors: string[]): string {
  const unused = TAG_PALETTE.filter(c => !existingColors.includes(c));
  if (unused.length > 0) return unused[0];
  return TAG_PALETTE[Math.floor(Math.random() * TAG_PALETTE.length)];
}

export async function createTag(name: string, projectId: UUID | null = null): Promise<Tag> {
  const existing = await db.tags.toArray();
  const color = pickColor(existing.map(t => t.color));
  const tag: Tag = {
    id: uuid(),
    name: name.trim(),
    color,
    isProjectTag: projectId !== null,
    projectId,
    createdAt: Date.now(),
  };
  await db.tags.put(tag);
  return tag;
}

export async function updateTag(tag: Tag): Promise<void> {
  await db.tags.put(tag);
}

export async function deleteTag(id: UUID): Promise<void> {
  await db.transaction('rw', db.tags, db.questions, db.projects, async () => {
    // Remove from all questions
    const qs = await db.questions.toArray();
    for (const q of qs) {
      if (q.tagIds.includes(id)) {
        await db.questions.put({ ...q, tagIds: q.tagIds.filter(t => t !== id), updatedAt: Date.now() });
      }
    }
    // Remove from all projects
    const ps = await db.projects.toArray();
    for (const p of ps) {
      if (p.tagIds.includes(id)) {
        await db.projects.put({ ...p, tagIds: p.tagIds.filter(t => t !== id), updatedAt: Date.now() });
      }
    }
    await db.tags.delete(id);
  });
}

export async function getAllTags(): Promise<Tag[]> {
  return db.tags.orderBy('name').toArray();
}

export async function getTagsByIds(ids: UUID[]): Promise<Tag[]> {
  return db.tags.where('id').anyOf(ids).toArray();
}

export async function countTagUsage(tagId: UUID): Promise<number> {
  const qs = await db.questions.toArray();
  return qs.filter(q => q.tagIds.includes(tagId)).length;
}

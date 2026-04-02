import { db } from './schema';
import type { Project, UUID } from '../types';
import { v4 as uuid } from 'uuid';

const PROJECT_COLORS = [
  '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6',
  '#f43f5e', '#06b6d4', '#84cc16', '#f97316',
];

export function newProject(): Project {
  const now = Date.now();
  const colorIdx = Math.floor(Math.random() * PROJECT_COLORS.length);
  return {
    id: uuid(),
    name: '',
    description: '',
    color: PROJECT_COLORS[colorIdx],
    tagIds: [],
    metadata: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveProject(p: Project): Promise<void> {
  await db.projects.put({ ...p, updatedAt: Date.now() });
}

export async function deleteProject(id: UUID): Promise<void> {
  await db.transaction('rw', db.projects, db.questions, async () => {
    // Orphan questions (don't delete them)
    const qs = await db.questions.where('projectId').equals(id).toArray();
    for (const q of qs) {
      await db.questions.put({ ...q, projectId: null, updatedAt: Date.now() });
    }
    await db.projects.delete(id);
  });
}

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.orderBy('createdAt').reverse().toArray();
}

export async function getProject(id: UUID): Promise<Project | undefined> {
  return db.projects.get(id);
}

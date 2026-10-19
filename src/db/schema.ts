import Dexie, { type Table } from 'dexie';
import type { Question, Project, Tag, ImageRecord, Workspace } from '../types';

export const DEFAULT_WORKSPACE_ID = 'default-workspace';

export class MockBankDB extends Dexie {
  workspaces!: Table<Workspace, string>;
  questions!: Table<Question, string>;
  projects!: Table<Project, string>;
  tags!: Table<Tag, string>;
  images!: Table<ImageRecord, string>;
  // key-value store for settings (image dir handle, active workspace, etc.)
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('MockBankDB');
    this.version(1).stores({
      questions: 'id, projectId, createdAt, updatedAt, status, difficulty',
      projects:  'id, createdAt',
      tags:      'id, name, projectId',
      images:    'id, addedAt',
      settings:  'key',
    });

    this.version(2).stores({
      workspaces: 'id, createdAt',
      questions:  'id, workspaceId, projectId, createdAt, updatedAt, status, difficulty',
      projects:   'id, workspaceId, createdAt',
      tags:       'id, workspaceId, parentId, name, projectId',
      images:     'id, addedAt',
      settings:   'key',
    }).upgrade(async tx => {
      const now = Date.now();
      await tx.table('workspaces').add({
        id: DEFAULT_WORKSPACE_ID,
        name: 'Default Workspace',
        description: 'Default workspace containing existing projects and questions',
        color: '#0078d4',
        createdAt: now,
        updatedAt: now,
      });

      await tx.table('questions').toCollection().modify((q: any) => {
        if (!q.workspaceId) q.workspaceId = DEFAULT_WORKSPACE_ID;
      });

      await tx.table('projects').toCollection().modify((p: any) => {
        if (!p.workspaceId) p.workspaceId = DEFAULT_WORKSPACE_ID;
      });

      await tx.table('tags').toCollection().modify((t: any) => {
        if (!t.workspaceId) t.workspaceId = DEFAULT_WORKSPACE_ID;
        if (t.parentId === undefined) t.parentId = null;
      });

      await tx.table('settings').put({ key: 'activeWorkspaceId', value: DEFAULT_WORKSPACE_ID });
    });
  }
}

export const db = new MockBankDB();

// ─── Settings helpers ─────────────────────────────────────────────────────────

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const rec = await db.settings.get(key);
  return rec?.value as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

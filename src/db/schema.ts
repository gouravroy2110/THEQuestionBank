import Dexie, { type Table } from 'dexie';
import type { Question, Project, Tag, ImageRecord } from '../types';

export class MockBankDB extends Dexie {
  questions!: Table<Question, string>;
  projects!: Table<Project, string>;
  tags!: Table<Tag, string>;
  images!: Table<ImageRecord, string>;
  // key-value store for settings (image dir handle, etc.)
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

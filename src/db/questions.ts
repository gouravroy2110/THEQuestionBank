import { db } from './schema';
import type { Question, UUID, ContentBlock } from '../types';
import { v4 as uuid } from 'uuid';
import { getActiveWorkspaceId } from './workspaces';

export function emptyContentBlock(): ContentBlock {
  return {
    segments: [{ type: 'markdown', id: uuid(), text: '' }],
  };
}

export function newQuestion(projectId: UUID | null = null, workspaceId?: UUID): Question {
  const now = Date.now();
  return {
    id: uuid(),
    workspaceId: workspaceId ?? 'default-workspace',
    projectId,
    questionContent: emptyContentBlock(),
    solutionContent: emptyContentBlock(),
    tagIds: [],
    metadata: [],
    status: 'unattempted',
    difficulty: 'unseen',
    source: '',
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveQuestion(q: Question): Promise<void> {
  const wsId = q.workspaceId || (await getActiveWorkspaceId());
  await db.questions.put({ ...q, workspaceId: wsId, updatedAt: Date.now() });
}

export async function deleteQuestion(id: UUID): Promise<void> {
  await db.questions.delete(id);
}

export async function getQuestion(id: UUID): Promise<Question | undefined> {
  return db.questions.get(id);
}

export async function getAllQuestions(): Promise<Question[]> {
  return db.questions.orderBy('createdAt').reverse().toArray();
}

export async function getQuestionsByProject(projectId: UUID): Promise<Question[]> {
  return db.questions.where('projectId').equals(projectId).reverse().sortBy('createdAt');
}

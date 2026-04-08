import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { Question, ResolvedQuestion, Tag, MetaField } from '../types';

export function useResolvedQuestion(question: Question | null): ResolvedQuestion | null {
  const project = useLiveQuery(
    () => question?.projectId ? db.projects.get(question.projectId) : Promise.resolve(undefined),
    [question?.projectId],
  );

  const allTags = useLiveQuery(() => db.tags.toArray(), []);

  if (!question || !allTags) return null;

  const tagMap = new Map<string, Tag>(allTags.map(t => [t.id, t]));

  const projectTagIds = project?.tagIds ?? [];
  const allTagIds = [...new Set([...projectTagIds, ...question.tagIds])];
  const effectiveTags = allTagIds.map(id => tagMap.get(id)).filter((t): t is Tag => !!t);

  const projectMeta: MetaField[] = project?.metadata ?? [];
  const effectiveMetadata = [...projectMeta, ...question.metadata];

  return {
    ...question,
    effectiveTags,
    effectiveMetadata,
    project: project ?? null,
  };
}

export function useAllTagsMap(): Map<string, Tag> {
  const tags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  return new Map(tags.map(t => [t.id, t]));
}
